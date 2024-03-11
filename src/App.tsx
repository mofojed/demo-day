import { useCallback, useMemo, useRef, useState } from "react";
import { Button, ButtonGroup } from "@deephaven/components";
import {
  vsDebugStop,
  vsDeviceCameraVideo,
  vsUnmute,
  vsRecord,
  vsVm,
  vsTriangleLeft,
  vsTriangleRight,
} from "@deephaven/icons";
import Log from "@deephaven/log";
import introVideo from "/intro.mp4";
import "./App.scss";
import { Drawable, DrawableContext, Resolution } from "./types";

const DEFAULT_FPS = 24;
const DEFAULT_RESOLUTION: Resolution = [1920, 1080];

const log = Log.module("App");

const userScene = {
  draw: (drawableContext: DrawableContext) => {
    const { context, resolution, video } = drawableContext;
    const [width, height] = resolution;
    context.drawImage(video, 0, 0, width, height);
  },
};

const demoScene = {
  draw: (drawableContext: DrawableContext) => {
    const { context, resolution, video, screen } = drawableContext;
    const [width, height] = resolution;
    // Draw the user in the scene
    // This is just an example, it's showing how to render it and then convert it to greyscale
    // However this is re-rendering in the same canvas. We may need to do it in another canvas so it can be layered properly...
    context.save();
    context.drawImage(screen, 0, 0, width, height);
    // TODO: If we want to do image manipulation like this, we really should do it in WebGL
    // This is way too slow, takes about 27ms just to render a single frame changing all the data to grayscale
    // Without this operation, it takes <1ms to render a frame

    // const frame = context.getImageData(0, 0, width, height);
    // const l = frame.data.length / 4;

    // for (let i = 0; i < l; i++) {
    //   const grey =
    //     (frame.data[i * 4 + 0] +
    //       frame.data[i * 4 + 1] +
    //       frame.data[i * 4 + 2]) /
    //     3;

    //   frame.data[i * 4 + 0] = grey;
    //   frame.data[i * 4 + 1] = grey;
    //   frame.data[i * 4 + 2] = grey;
    // }
    // context.putImageData(frame, 0, 0);
    // End of grayscale operation (which is slow af)

    // Now draw the user, but mask the limage so it's in a circle
    context.beginPath();
    context.arc(260, 220, 120, 0, Math.PI * 2, true);
    context.clip();
    context.drawImage(video, 100, 100, 320, 240);
    context.restore();
  },
};

const introElement = document.createElement("video");
introElement.src = introVideo;
introElement.loop = true;
introElement.muted = true;
introElement.play();

const sceneIntro = {
  draw: (drawableContext: DrawableContext) => {
    const { context, resolution } = drawableContext;
    const [width, height] = resolution;
    context.drawImage(introElement, 0, 0, width, height);
  },
};

const screenScene = {
  draw: (drawableContext: DrawableContext) => {
    const { context, resolution, screen } = drawableContext;
    const [width, height] = resolution;
    context.drawImage(screen, 0, 0, width, height);
  },
};

const scenes: Drawable[] = [sceneIntro, userScene, demoScene, screenScene];

type AppProps = {
  fps?: number;
  resolution?: [number, number];
};

function App({
  fps = DEFAULT_FPS,
  resolution = DEFAULT_RESOLUTION,
}: AppProps = {}) {
  const [width, height] = resolution;
  const videoElement = useRef<HTMLVideoElement>(null);
  const screenElement = useRef<HTMLVideoElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const outputVideoElement = useRef<HTMLVideoElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [streams, setStreams] = useState<MediaStream[]>([]);
  const [renderInterval, setRenderInterval] =
    useState<ReturnType<typeof setInterval>>(0);
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null);
  const sceneIndex = useRef<number>(0);

  const handleStop = useCallback(() => {
    clearInterval(renderInterval);
    streams.forEach((stream) => {
      stream.getTracks().forEach((track) => track.stop());
    });
    videoElement.current!.srcObject = null;
    screenElement.current!.srcObject = null;
    recorder?.stop();
    setIsRecording(false);
  }, [recorder, renderInterval, streams]);

  const handleStart = useCallback(async () => {
    try {
      const canvas = canvasElement.current!;
      const context = canvas.getContext("2d")!;
      const video = videoElement.current!;
      const screen = screenElement.current!;
      const outputVideo = outputVideoElement.current!;

      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
      });
      log.info("Got video streams", screenStream, videoStream);

      video.srcObject = videoStream;
      screen.srcObject = screenStream;

      const renderInterval = setInterval(function drawFrame() {
        // Draw using the scenes
        const drawable = scenes[sceneIndex.current % scenes.length];
        drawable.draw({
          context,
          resolution: [width, height],
          video,
          screen,
        });
      }, 1000 / fps);

      const outputStream = canvas.captureStream(fps);
      outputStream.addTrack(audioStream.getAudioTracks()[0]);

      outputVideo.srcObject = outputStream;

      const recorder = new MediaRecorder(outputStream);
      const recordedChunks: Blob[] = [];

      recorder.ondataavailable = function (e) {
        log.debug2("Data available", e);
        if (e.data.size > 0) {
          recordedChunks.push(e.data);
        }
      };
      recorder.onstop = function () {
        log.info("Recording stopped");
        const blob = new Blob(recordedChunks, {
          type: "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "test.webm";
        a.click();
        URL.revokeObjectURL(url);
      };
      recorder.start();

      navigator.mediaSession.playbackState = "playing";
      navigator.mediaSession.setActionHandler("play", () => {
        log.info("Play button pressed");
      });
      navigator.mediaSession.setActionHandler("stop", () => {
        log.info("Stop button pressed");
        handleStop();
      });

      navigator.mediaSession.setActionHandler("nexttrack", () => {
        log.info("Next track button pressed");
        sceneIndex.current++;
      });
      navigator.mediaSession.metadata = new MediaMetadata({
        title: "Demo Day",
        artist: "Deephaven",
        album: "Deephaven Demo Day",
        artwork: [
          { src: "icon.png", sizes: "96x96", type: "image/png" },
          { src: "icon.png", sizes: "128x128", type: "image/png" },
          { src: "icon.png", sizes: "192x192", type: "image/png" },
          { src: "icon.png", sizes: "256x256", type: "image/png" },
          { src: "icon.png", sizes: "384x384", type: "image/png" },
          { src: "icon.png", sizes: "512x512", type: "image/png" },
        ],
      });

      setStreams([videoStream, screenStream, outputStream]);
      setRenderInterval(renderInterval);
      setIsRecording(true);
      setRecorder(recorder);
    } catch (e) {
      log.error("Unable to get video stream", e);
    }
  }, [fps, handleStop, height, width]);

  return (
    <div className="app-view">
      <ButtonGroup>
        <Button kind="tertiary" icon={vsUnmute} tooltip="Microphone" />
        <Button kind="tertiary" icon={vsDeviceCameraVideo} tooltip="Camera" />
        <Button kind="tertiary" icon={vsVm} tooltip="Screenshare" />
      </ButtonGroup>
      <video
        id="video"
        controls={false}
        ref={outputVideoElement}
        loop
        autoPlay
        muted
      />
      <ButtonGroup>
        <Button
          kind="secondary"
          icon={vsTriangleLeft}
          tooltip="Previous Scene"
          onClick={() => sceneIndex.current--}
        />
        {!isRecording ? (
          <Button
            kind="danger"
            icon={vsRecord}
            tooltip="Record"
            onClick={handleStart}
            style={{ background: "transparent" }}
          />
        ) : (
          <Button
            kind="danger"
            icon={vsDebugStop}
            tooltip="Stop"
            onClick={handleStop}
          />
        )}
        <Button
          kind="secondary"
          icon={vsTriangleRight}
          tooltip="Next Scene"
          onClick={() => sceneIndex.current++}
        />
      </ButtonGroup>

      {/* Some elements that we use for video streams and rendering the scene, but we don't want the user to actually see them */}
      <div style={{ display: "none" }}>
        <video
          id="video"
          width={width}
          height={height}
          controls={false}
          ref={videoElement}
          loop
          autoPlay
        />
        <video
          id="video"
          width={width}
          height={height}
          controls={false}
          ref={screenElement}
          loop
          autoPlay
        />
        <canvas id="canvas" width={width} height={height} ref={canvasElement} />
      </div>
    </div>
  );
}

export default App;
