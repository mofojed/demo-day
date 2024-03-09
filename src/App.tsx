import { useCallback, useEffect, useRef, useState } from "react";
import Log from "@deephaven/log";
// import logo from "/react.svg";
import silentAudio from "/silence.mp3";
import "./App.css";
import { Drawable, DrawableContext } from "./types";

const log = Log.module("App");

// console.log("Logo is", logo);
// const audioURL = new URL("/assets/silence.mp3", import.meta.url);

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
  const audioElement = useRef<HTMLAudioElement>(null);
  const videoElement = useRef<HTMLVideoElement>(null);
  const screenElement = useRef<HTMLVideoElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);
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
    audioElement.current!.pause();
    recorder?.stop();
    setIsRecording(false);
  }, [recorder, renderInterval, streams]);

  const handleStart = useCallback(async () => {
    try {
      // Taken from Codepen: https://codepen.io/idorenyinudoh/pen/vYKQVqQ
      // Need to have an active element playing when using mediaSession API I guess
      // Should be blank audio instead of music...
      // const audio = document.createElement("audio");
      // audio.src = "https://assets.codepen.io/4358584/Anitek_-_Carry_On.mp3";
      // audio.controls = false;
      // audio.loop = true;
      // audio.play();
      audioElement.current!.play();

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

      const video = videoElement.current!;
      const screen = screenElement.current!;
      const canvas = canvasElement.current!;
      const context = canvas.getContext("2d")!;
      video.srcObject = videoStream;
      screen.srcObject = screenStream;
      video.play();
      screen.play();

      const renderInterval = setInterval(function drawFrame() {
        // This is just an example, it's showing how to render it and then convert it to greyscale
        // However this is re-rendering in the same canvas. We may need to do it in another canvas so it can be layered properly...
        // context.save();
        // context.drawImage(screen, 0, 0, width, height);
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

        // // Now draw the user, but mask the limage so it's in a circle
        // context.beginPath();
        // context.arc(260, 220, 120, 0, Math.PI * 2, true);
        // context.clip();
        // context.drawImage(video, 100, 100, 320, 240);
        // context.restore();

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
        <audio
          src={silentAudio}
          // src="https://assets.codepen.io/4358584/Anitek_-_Carry_On.mp3"
          // src={audioURL.href}
          ref={audioElement}
          style={{ display: "none" }}
          loop
          controls={false}
        />
        <video
          id="video"
          width={width}
          height={height}
          controls={false}
          style={{ display: "none" }}
          ref={videoElement}
          loop
        ></video>
        <video
          id="video"
          width={width}
          height={height}
          controls={false}
          style={{ display: "none" }}
          ref={screenElement}
          loop
        ></video>
        {!isRecording ? (
          <button onClick={handleStart}>Start</button>
        ) : (
          <button onClick={handleStop}>Stop</button>
        )}
        <canvas
          id="canvas"
          width={width}
          height={height}
          ref={canvasElement}
          style={{ background: "salmon" }}
        ></canvas>
      </div>
    </>
  );
}

export default App;
