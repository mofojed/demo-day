import { useCallback, useEffect, useRef, useState } from "react";
import Log from "@deephaven/log";
import "./App.css";

const log = Log.module("App");

function App() {
  const videoElement = useRef<HTMLVideoElement>(null);
  const canvasElement = useRef<HTMLCanvasElement>(null);
  const width = 1920;
  const height = 1080;

  // useEffect(() => {
  //   async function initVideo() {}
  //   initVideo();
  // }, []);

  const handleStart = useCallback(async () => {
    try {
      // const videoStream = await navigator.mediaDevices.getUserMedia({
      //   video: true,
      // });
      const videoStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
      });
      log.info("Got video stream", videoStream);
      // videoElement.current!.srcObject = videoStream;
      const video = videoElement.current!;
      const canvas = canvasElement.current!;
      const context = canvas.getContext("2d")!;
      video.srcObject = videoStream;

      setInterval(function drawFrame() {
        // This is just an example, it's showing how to render it and then convert it to greyscale
        // However this is re-rendering in the same canvas. We may need to do it in another canvas so it can be layered properly...
        context.drawImage(video, 0, 0, width, height);
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
      }, 16);
    } catch (e) {
      log.error("Unable to get video stream", e);
    }
  }, []);

  return (
    <>
      <h1>Demo Day</h1>
      <div>
        <video
          id="video"
          width={width}
          height={height}
          autoPlay
          style={{ display: "none" }}
          ref={videoElement}
        ></video>
        <button onClick={handleStart}>Start</button>
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
