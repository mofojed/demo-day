import { useCallback, useRef, useState } from "react";
import { Button } from "@deephaven/components";
import Log from "@deephaven/log";
import "./App.css";
import { Drawable, DrawableContext } from "./types";

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
    const frame = context.getImageData(0, 0, width, height);
    const l = frame.data.length / 4;

    for (let i = 0; i < l; i++) {
      const grey =
        (frame.data[i * 4 + 0] +
          frame.data[i * 4 + 1] +
          frame.data[i * 4 + 2]) /
        3;

      frame.data[i * 4 + 0] = grey;
      frame.data[i * 4 + 1] = grey;
      frame.data[i * 4 + 2] = grey;
    }
    context.putImageData(frame, 0, 0);

    // Now draw the user, but mask the limage so it's in a circle
    context.beginPath();
    context.arc(260, 220, 120, 0, Math.PI * 2, true);
    context.clip();
    context.drawImage(video, 100, 100, 320, 240);
    context.restore();
  },
};

const screenScene = {
  draw: (drawableContext: DrawableContext) => {
    const { context, resolution, screen } = drawableContext;
    const [width, height] = resolution;
    context.drawImage(screen, 0, 0, width, height);
  },
};

const scenes: Drawable[] = [userScene, demoScene, screenScene];

function App() {
  const videoElement = useRef<HTMLVideoElement>(null);
  const screenElement = useRef<HTMLVideoElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const outputVideoElement = useRef<HTMLVideoElement>(null);
  const width = 1920;
  const height = 1080;
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
    outputVideoElement.current!.srcObject = null;
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
      const outputStream = canvas.captureStream(60);
      outputVideo.srcObject = outputStream;

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
      }, 16);

      const recordStream = canvas.captureStream(60);
      recordStream.addTrack(audioStream.getAudioTracks()[0]);
      const recorder = new MediaRecorder(recordStream);
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

      // const canvasVideo = document.createElement("video");
      // canvasVideo.srcObject = recordStream;
      // canvasVideo.muted = true;
      // canvasVideo.loop = true;
      // canvasVideo.play();

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

      setStreams([videoStream, screenStream, recordStream]);
      setRenderInterval(renderInterval);
      setIsRecording(true);
      setRecorder(recorder);
    } catch (e) {
      log.error("Unable to get video stream", e);
    }
  }, [handleStop]);

  return (
    <>
      <h1>Demo Day</h1>
      <div>
        <video
          id="video"
          width={width}
          height={height}
          controls={false}
          style={{ display: "none" }}
          ref={videoElement}
          loop
          autoPlay
        ></video>
        <video
          id="video"
          width={width}
          height={height}
          controls={false}
          style={{ display: "none" }}
          ref={screenElement}
          loop
          autoPlay
        ></video>
        {!isRecording ? (
          <Button kind="primary" placeholder="Start" onClick={handleStart}>
            Start
          </Button>
        ) : (
          <Button kind="danger" placeholder="Stop" onClick={handleStop}>
            Stop
          </Button>
        )}
        <canvas
          id="canvas"
          width={width}
          height={height}
          ref={canvasElement}
          style={{ background: "salmon", display: "none" }}
        ></canvas>
        <video
          id="video"
          width={width}
          height={height}
          // controls={false}
          // style={{ display: "none" }}
          ref={outputVideoElement}
          loop
          autoPlay
        ></video>
      </div>
    </>
  );
}

export default App;
