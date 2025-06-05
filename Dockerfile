FROM python:3.10-slim

# Install OS-level dependencies including Xvfb, tkinter, unzip, etc.
RUN apt-get update -o Acquire::Check-Valid-Until=false && apt-get install -y \
    xvfb \
    portaudio19-dev \
    libglib2.0-0 \
    libnss3 \
    libgconf-2-4 \
    libgbm1 \
    libfontconfig1 \
    python3-tk \
    python3-dev \
    build-essential \
    wget \
    unzip \
    curl \
    gnupg \
    pulseaudio \
    pulseaudio-utils \
    && rm -rf /var/lib/apt/lists/*


WORKDIR /app

# Copy requirements file and install Python dependencies
COPY requirements.txt /app/requirements.txt
RUN pip install --upgrade pip && pip install -r requirements.txt

# Install Microsoft Edge for Linux
RUN curl https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor > microsoft.gpg \
    && install -o root -g root -m 644 microsoft.gpg /etc/apt/trusted.gpg.d/ \
    && rm microsoft.gpg \
    && sh -c 'echo "deb [arch=amd64] https://packages.microsoft.com/repos/edge stable main" > /etc/apt/sources.list.d/microsoft-edge.list' \
    && apt-get update \
    && apt-get install -y microsoft-edge-stable

# Download and install the Linux msedgedriver (ensure the URL matches your version)
RUN wget -O msedgedriver.zip https://msedgedriver.azureedge.net/137.0.3296.62/edgedriver_linux64.zip \
    && unzip msedgedriver.zip -d /usr/local/bin/ \
    && chmod +x /usr/local/bin/msedgedriver \
    && rm msedgedriver.zip

# Copy the rest of your application code
COPY . /app

# Create an empty .Xauthority file for Xvfb/pyautogui usage
RUN touch ${HOME}/.Xauthority

# Copy the entrypoint script, convert Windows CRLF to Unix LF, and set executable permissions
COPY entrypoint.sh /app/entrypoint.sh
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

VOLUME ["/app/selenium_profile"]

ENV DISPLAY=:99
ENV EDGE_DRIVER_PATH=/usr/local/bin/msedgedriver

EXPOSE 8000

ENTRYPOINT ["/app/entrypoint.sh"]