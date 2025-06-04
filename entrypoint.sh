#!/bin/bash
# Ensure .Xauthority exists (already created during image build, but re-check if needed)
touch ${HOME}/.Xauthority

# Start PulseAudio if not already running and load a null sink for virtual audio.
if ! pgrep -x pulseaudio > /dev/null; then
  echo "Starting PulseAudio..."
  pulseaudio --start
  pactl load-module module-null-sink sink_name=VirtualSink
fi

# Remove any existing Xvfb lock file for display :99 if it exists.
if [ -f /tmp/.X99-lock ]; then
    echo "Removing existing Xvfb lock file..."
    rm -f /tmp/.X99-lock
fi

# Start Xvfb on display :99.
echo "Starting Xvfb on display :99..."
Xvfb :99 -screen 0 1920x1080x24 &
sleep 3

# Start server.py in the background.
echo "Starting server.py..."
python server.py &
server_pid=$!

# Start script.py in the background.
echo "Starting script.py..."
python script.py &
script_pid=$!

# Optionally, print process IDs for debugging.
echo "server.py PID: ${server_pid}"
echo "script.py PID: ${script_pid}"

# Wait for all background processes to finish.
wait