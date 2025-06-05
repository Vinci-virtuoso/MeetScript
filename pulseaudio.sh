#!/bin/bash

# WSL PulseAudio Setup Script for Google Meet Audio Capture
# This script sets up PulseAudio in WSL to capture system audio

echo "Setting up PulseAudio for WSL audio capture..."

# Update package lists
sudo apt-get update

# Install PulseAudio and related packages
sudo apt-get install -y \
    pulseaudio \
    pulseaudio-utils \
    pavucontrol \
    paprefs \
    alsa-utils \
    sox \
    libpulse-dev \
    python3-pyaudio

# Create PulseAudio configuration directory
mkdir -p ~/.config/pulse

# Create PulseAudio configuration for WSL
cat > ~/.config/pulse/default.pa << 'EOF'
#!/usr/bin/pulseaudio -nF

# Include the default configuration
.include /etc/pulse/default.pa

# Load the native protocol module for network access (if needed)
load-module module-native-protocol-unix auth-anonymous=1 socket=/tmp/pulse-socket

# Load a null sink for virtual audio routing
load-module module-null-sink sink_name=VirtualSink sink_properties=device.description="Virtual_Sink"

# Load the loopback module to route system audio to our virtual sink
load-module module-loopback source=auto_null.monitor sink=VirtualSink

# Load module to combine sinks (optional, for monitoring)
load-module module-combine-sink sink_name=combined slaves=VirtualSink

# Enable module for monitoring
load-module module-remap-source source_name=VirtualSource master=VirtualSink.monitor source_properties=device.description="Virtual_Source_Monitor"
EOF

# Create PulseAudio client configuration
cat > ~/.config/pulse/client.conf << 'EOF'
# Connect to the local PulseAudio server
default-server = unix:/tmp/pulse-socket
# Enable shared memory
enable-shm = yes
EOF

# Create systemd user service for PulseAudio (if systemd is available)
if command -v systemctl &> /dev/null; then
    mkdir -p ~/.config/systemd/user
    cat > ~/.config/systemd/user/pulseaudio.service << 'EOF'
[Unit]
Description=PulseAudio system server
After=basic.target

[Service]
Type=notify
ExecStart=/usr/bin/pulseaudio --daemonize=no --system --realtime --disallow-exit --disallow-module-loading
ExecReload=/bin/kill -HUP $MAINPID
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
EOF
fi

# Set environment variables for PulseAudio
echo 'export PULSE_RUNTIME_PATH="/tmp/pulse"' >> ~/.bashrc
echo 'export PULSE_SERVER="unix:/tmp/pulse-socket"' >> ~/.bashrc

# Create startup script
cat > ~/start_pulseaudio.sh << 'EOF'
#!/bin/bash

# Kill any existing PulseAudio processes
pulseaudio -k 2>/dev/null || true
pkill -f pulseaudio 2>/dev/null || true

# Clean up old socket
rm -f /tmp/pulse-socket
mkdir -p /tmp/pulse

# Start PulseAudio daemon
pulseaudio --start --log-target=syslog --system=false

# Wait for PulseAudio to start
sleep 3

# Load the virtual sink module
pactl load-module module-null-sink sink_name=VirtualSink sink_properties=device.description="Virtual_Audio_Sink"

# Load the loopback module to capture system audio
pactl load-module module-loopback source=auto_null.monitor sink=VirtualSink latency_msec=50

# Create a monitor source for our virtual sink
pactl load-module module-remap-source source_name=VirtualMicSource master=VirtualSink.monitor source_properties=device.description="Virtual_Microphone_Source"

# Set the default sink to our virtual sink
pactl set-default-sink VirtualSink

# Set the default source to our virtual microphone
pactl set-default-source VirtualMicSource

echo "PulseAudio setup complete!"
echo "Virtual Sink: VirtualSink"
echo "Virtual Source: VirtualMicSource"

# List available sources and sinks
echo "Available sinks:"
pactl list short sinks
echo "Available sources:"
pactl list short sources
EOF

chmod +x ~/start_pulseaudio.sh

echo "PulseAudio setup complete!"
echo "Run: ~/start_pulseaudio.sh to start PulseAudio with virtual audio routing"
echo "Then source ~/.bashrc or restart your terminal"