import { useCallback, useEffect, useRef, useState } from "react";
import Log from "@deephaven/log";
import "./App.css";

const log = Log.module("App");

function App() {
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

  const handleStart = useCallback(async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
      });
      log.info("Got video streams", screenStream, videoStream);

      // videoElement.current!.srcObject = videoStream;

      const video = videoElement.current!;
      const screen = screenElement.current!;
      const canvas = canvasElement.current!;
      const context = canvas.getContext("2d")!;
      video.srcObject = videoStream;
      screen.srcObject = screenStream;

      const renderInterval = setInterval(function drawFrame() {
        // This is just an example, it's showing how to render it and then convert it to greyscale
        // However this is re-rendering in the same canvas. We may need to do it in another canvas so it can be layered properly...
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
      }, 16);

      const recordStream = canvas.captureStream(60);
      // TODO: Add audio
      // recordStream.addTrack(audio.getAudioTracks()[0]);
      const recorder = new MediaRecorder(recordStream);
      const recordedChunks: Blob[] = [];

      recorder.ondataavailable = function (e) {
        log.info("Data available", e);
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

      setStreams([videoStream, screenStream, recordStream]);
      setRenderInterval(renderInterval);
      setIsRecording(true);
      setRecorder(recorder);
    } catch (e) {
      log.error("Unable to get video stream", e);
    }
  }, []);

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
        <video
          id="video"
          width={width}
          height={height}
          autoPlay
          style={{ display: "none" }}
          ref={screenElement}
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
