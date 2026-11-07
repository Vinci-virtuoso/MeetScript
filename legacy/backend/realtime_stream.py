#!/usr/bin/env python3
import sys
import asyncio
import warnings

# Optionally, suppress deprecation warnings from websockets if desired.
warnings.filterwarnings("ignore", category=DeprecationWarning, module="websockets")

# Helper function to patch a function to ignore the 'loop' keyword argument.
def patch_func(func):
    def wrapper(*args, **kwargs):
        kwargs.pop('loop', None)
        return func(*args, **kwargs)
    return wrapper

# Patch asyncio functions to ignore the 'loop' parameter.
asyncio.sleep = patch_func(asyncio.sleep)
asyncio.wait = patch_func(asyncio.wait)
asyncio.wait_for = patch_func(asyncio.wait_for)

# Patch asyncio.Lock.__init__ to ignore the 'loop' keyword argument.
_orig_lock_init = asyncio.Lock.__init__
def lock_init_patch(self, *args, **kwargs):
    kwargs.pop('loop', None)
    _orig_lock_init(self, *args, **kwargs)
asyncio.Lock.__init__ = lock_init_patch

if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import pyaudio
import argparse
import aiohttp
import json
import os
import wave
import websockets
from datetime import datetime

# Global configuration and state.
startTime = datetime.now()
all_mic_data = []
all_transcripts = []

transcript_file_name = os.path.join(os.path.curdir, "transcript.txt")

FORMAT = pyaudio.paInt16
CHANNELS = 1
RATE = 16000
CHUNK = 8000
audio_queue = asyncio.Queue()
REALTIME_RESOLUTION = 0.1
subtitle_line_counter = 0

def log_audio_devices():
    pa = pyaudio.PyAudio()
    device_count = pa.get_device_count()
    print(f"Found {device_count} audio devices:",flush=True)
    for i in range(device_count):
        try:
            info = pa.get_device_info_by_index(i)
            print(f"Device {i}: {info.get('name')}, Input Channels: {info.get('maxInputChannels')}",flush=True)
        except Exception as e:
            print(f"Error getting info for device {i}: {e}",flush=True)
    if device_count == 0:
        print("WARNING: No audio devices available!",flush=True)
    pa.terminate()

# Log available audio devices.
log_audio_devices()

# Initialize PyAudio and open the input stream.
audio = pyaudio.PyAudio()
try:
    stream = audio.open(
        format=FORMAT,
        channels=CHANNELS,
        rate=RATE,
        input=True,
        frames_per_buffer=CHUNK,
        stream_callback=lambda in_data, frame_count, time_info, status: (in_data, pyaudio.paContinue)
    )
    stream.start_stream()
    print("Audio stream initialized successfully.",flush=True)
except Exception as e:
    print(f"ERROR initializing audio stream: {e}",flush=True)

def close_audio_stream():
    global stream, audio
    try:
        if stream is not None:
            stream.stop_stream()
            stream.close()
        if audio is not None:
            audio.terminate()
        print("Audio stream closed and PyAudio terminated.", flush=True)
    except Exception as e:
        print(f"Error closing audio stream: {e}", flush=True)

def subtitle_time_formatter(seconds, separator):
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int((seconds - int(seconds)) * 1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{separator}{millis:03}"

def subtitle_formatter(response, output_format):
    global subtitle_line_counter
    subtitle_line_counter += 1
    start = response["start"]
    end = start + response["duration"]
    transcript = response.get("channel", {}).get("alternatives", [{}])[0].get("transcript", "")
    separator = "," if output_format == "srt" else '.'
    prefix = "- " if output_format == "vtt" else ""
    subtitle_string = (
        f"{subtitle_line_counter}\n"
        f"{subtitle_time_formatter(start, separator)} --> {subtitle_time_formatter(end, separator)}\n"
        f"{prefix}{transcript}\n\n"
    )
    return subtitle_string

def mic_callback(input_data, frame_count, time_info, status_flag):
    audio_queue.put_nowait(input_data)
    return (input_data, pyaudio.paContinue)

async def run(key, method, output_format, **kwargs):
    deepgram_url = f'{kwargs["host"]}/v1/listen?punctuate=true'
    if kwargs.get("model"):
        deepgram_url += f"&model={kwargs['model']}"
    if kwargs.get("tier"):
        deepgram_url += f"&tier={kwargs['tier']}"
    if method == "mic":
        deepgram_url += "&encoding=linear16&sample_rate=16000"
    elif method == "wav":
        data = kwargs["data"]
        deepgram_url += f'&channels={kwargs["channels"]}&sample_rate={kwargs["sample_rate"]}&encoding=linear16'
    try:
        async with websockets.connect(deepgram_url, extra_headers={"Authorization": f"Token {key}"}) as ws:
            print(f'ℹ️  Request ID: {ws.response_headers.get("dg-request-id")}')
            if kwargs.get("model"):
                print(f'ℹ️  Model: {kwargs["model"]}')
            if kwargs.get("tier"):
                print(f'ℹ️  Tier: {kwargs["tier"]}')
            print("🟢 (1/5) Successfully opened Deepgram streaming connection",flush=True)
    
            async def sender(ws):
                print(
                    f'🟢 (2/5) Ready to stream {"mic" if method=="mic" else kwargs.get("filepath", "audio")} audio to Deepgram' +
                    (". Speak into your microphone to transcribe." if method=="mic" else ""),flush=True
                )
                if method == "mic":
                    try:
                        while True:
                            mic_data = await audio_queue.get()
                            all_mic_data.append(mic_data)
                            await ws.send(mic_data)
                    except websockets.exceptions.ConnectionClosedOK:
                        await ws.send(json.dumps({"type": "CloseStream"}))
                        ("🟢 (5/5) Successfully closed Deepgram connection, waiting for final transcripts if necessary")
                    except Exception as e:
                        print(f"Error while sending: {str(e)}",flush=True)
                        raise
                elif method == "url":
                    async with aiohttp.ClientSession() as session:
                        async with session.get(kwargs["url"]) as audio:
                            while True:
                                remote_url_data = await audio.content.readany()
                                await ws.send(remote_url_data)
                                if not remote_url_data:
                                    break
                elif method == "wav":
                    nonlocal data
                    byte_rate = (kwargs["sample_width"] * kwargs["sample_rate"] * kwargs["channels"])
                    chunk_size = int(byte_rate * REALTIME_RESOLUTION)
                    try:
                        while len(data):
                            chunk, data = data[:chunk_size], data[chunk_size:]
                            await asyncio.sleep(REALTIME_RESOLUTION)
                            await ws.send(chunk)
                        await ws.send(json.dumps({"type": "CloseStream"}))
                        print("🟢 (5/5) Successfully closed Deepgram connection, waiting for final transcripts if necessary",flush=True)
                    except Exception as e:
                        print(f"🔴 ERROR: Something happened while sending, {e}",flush=True)
                        raise e
                return

            async def receiver(ws):
                first_message = True
                first_transcript = True
                transcript = ""
                termination_event = kwargs.get("termination_event")
                async for msg in ws:
                    res = json.loads(msg)
                    if first_message:
                        print("🟢 (3/5) Successfully receiving Deepgram messages, waiting for finalized transcription...",flush=True)
                        first_message = False
                    try:
                        if res.get("msg"):
                            print(res["msg"],flush=True)
                        if res.get("is_final"):
                            transcript = res.get("channel", {}).get("alternatives", [{}])[0].get("transcript", "")
                            #if kwargs.get("timestamps"):
                                #words = res.get("channel", {}).get("alternatives", [{}])[0].get("words", [])
                                #start = words[0]["start"] if words else None
                                #end = words[-1]["end"] if words else None
                                #transcript += f" [{start} - {end}]" if (start and end) else ""
                            if transcript != "":
                                if first_transcript:
                                    print("🟢 (4/5) Began receiving transcription",flush=True)
                                    if output_format == "vtt":
                                        print("WEBVTT\n",flush=True)
                                    with open(transcript_file_name, "w") as transcript_file:
                                        transcript_file.write(transcript + "\n")    
                                        first_transcript = False
                                else:

                                    if output_format in ("vtt", "srt"):
                                        transcript = subtitle_formatter(res, output_format)
                                    print(transcript,flush=True)
                                    all_transcripts.append(transcript)
                                    with open(transcript_file_name,"a") as transcript_file:
                                        transcript_file.write(transcript + "\n")

                            if method == "mic" and "goodbye" in transcript.lower():
                                await ws.send(json.dumps({"type": "CloseStream"}))
                                if termination_event:
                                    termination_event.set()   # <-- Set the termination signal
                                print("🟢 (5/5) Successfully closed Deepgram connection, waiting for final transcripts if necessary", flush=True)
                                await ws.close()  # Explicitly close the websocket.
                                break
                        if res.get("created"):
                            if output_format in ("vtt", "srt"):
                                data_dir = os.path.abspath(os.path.join(os.path.curdir, "data"))
                                if not os.path.exists(data_dir):
                                    os.makedirs(data_dir)
                                transcript_file_path = os.path.join(data_dir, f"{startTime.strftime('%Y%m%d%H%M')}.{output_format}")
                                with open(transcript_file_path, "w") as f:
                                    f.write("".join(all_transcripts))
                                print(f"🟢 Subtitles saved to {transcript_file_path}")
                                if method == "mic":
                                    wave_file_path = os.path.join(data_dir, f"{startTime.strftime('%Y%m%d%H%M')}.wav")
                                    wave_file = wave.open(wave_file_path, "wb")
                                    wave_file.setnchannels(CHANNELS)
                                    wave_file.setsampwidth(SAMPLE_SIZE)
                                    wave_file.setframerate(RATE)
                                    wave_file.writeframes(b"".join(all_mic_data))
                                    wave_file.close()
                                    print(f"🟢 Mic audio saved to {wave_file_path}",flush=True)
                            print(f'🟢 Request finished with a duration of {res["duration"]} seconds. Exiting!',flush=True)
                    except KeyError:
                        print(f"🔴 ERROR: Received unexpected API response! {msg}")
    
            async def microphone():
                audio = pyaudio.PyAudio()
                stream = audio.open(
                    format=FORMAT,
                    channels=CHANNELS,
                    rate=RATE,
                    input=True,
                    frames_per_buffer=CHUNK,
                    stream_callback=mic_callback,
                )
                stream.start_stream()
                global SAMPLE_SIZE
                SAMPLE_SIZE = audio.get_sample_size(FORMAT)
                while stream.is_active():
                    await asyncio.sleep(0.1)
                stream.stop_stream()
                stream.close()
    
            functions = [
                asyncio.ensure_future(sender(ws)),
                asyncio.ensure_future(receiver(ws)),
            ]
            if method == "mic":
                functions.append(asyncio.ensure_future(microphone()))
            await asyncio.gather(*functions)
    except websockets.exceptions.InvalidStatusCode as e:
         print(f'🔴 ERROR: Could not connect to Deepgram! {e}')
         return
    except Exception as e:
         print(f'🔴 ERROR: {e}')
         return

class RealTimeTranscriber:
    def __init__(self, api_key, host="wss://api.deepgram.com", output_format="text", model=None, tier=None, timestamps=False):
        self.api_key = api_key
        self.host = host
        self.output_format = output_format
        self.model = model
        self.tier = tier
        self.timestamps = timestamps
        self.task = None
        self.running = False
        self.termination_event = asyncio.Event()

    async def _stream(self):
        try:
            await run(self.api_key, "mic", self.output_format, host=self.host, model=self.model, tier=self.tier, timestamps=self.timestamps,termination_event=self.termination_event)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            print(f"🔴 ERROR during streaming: {e}")
    
    def start(self):
        if not self.running:
            self.running = True
            self.task = asyncio.create_task(self._stream())
            print("Real-time transcription started.",flush=True)
    
    async def stop(self):
        if self.task and not self.task.done():
            self.task.cancel()
            try:
                # Wrap the task cancellation with a timeout of 10 seconds.
                await asyncio.wait_for(self.task, timeout=10)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                print("Real-time transcription task cancellation timed out or cancelled.", flush=True)
            self.running = False
            print("Real-time transcription stopped.", flush=True)
        # Ensure that the PyAudio stream is closed.
        close_audio_stream()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Real-time transcription using Deepgram (mic mode).")
    parser.add_argument("-k", "--key", required=True, help="Your Deepgram API Key")
    parser.add_argument("--host", default="wss://api.deepgram.com", help="Deepgram WebSocket host")
    parser.add_argument("-f", "--format", default="text", choices=["text", "vtt", "srt"], help="Output format")
    args = parser.parse_args()
    
    async def main():
        transcriber = RealTimeTranscriber(api_key=args.key, host=args.host, output_format=args.format)
        transcriber.start()
        try:
            # Run transcription for 60 seconds in test mode.
            await asyncio.sleep(60)
        finally:
            await transcriber.stop()
    
    asyncio.run(main())