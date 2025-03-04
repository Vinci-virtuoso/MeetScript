import time
import logging
import pyautogui
from selenium import webdriver
from selenium.webdriver.edge.service import Service as EdgeService
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

class GoogleMeetAutoLogin:
    def __init__(self, driver_path=r'C:\Users\ayo\Webdriver\msedgedriver.exe', join_template_path=r'C:\Users\ayo\MeetScript\ask_to_join.png'):
        """
        Initializes the GoogleMeetAutoLogin class with the WebDriver path and a screenshot template for the 'Ask to join' button.
        """
        self.driver_path = driver_path
        self.join_template_path = join_template_path
        self.driver = None
        self.setup_logging()

    def setup_logging(self):
        """
        Sets up logging to track the flow of the script.
        """
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)

    def setup_driver(self):
        """
        Sets up the Microsoft Edge WebDriver with options and returns True if successful.
        """
        try:
            edge_options = Options()
            edge_options.add_argument('--no-sandbox')
            edge_options.add_argument('--disable-dev-shm-usage')
            edge_options.add_argument('--force-dark-mode')
            edge_options.add_argument("--disable-extensions")
            edge_options.add_argument("--window-size=1920,1080")
            edge_options.add_argument("--disable-blink-features=AutomationControlled")
            edge_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            edge_options.add_experimental_option("useAutomationExtension", False)
            edge_options.add_experimental_option("prefs", {
                "profile.managed_default_content_settings.media_stream_mic": 2,
                "profile.managed_default_content_settings.media_stream_camera": 2,
                "profile.default_content_setting_values.media_stream_mic": 2,
                "profile.default_content_setting_values.media_stream_camera": 2
            })
            service = EdgeService(executable_path=self.driver_path)
            self.driver = webdriver.Edge(service=service, options=edge_options)
            self.logger.info("WebDriver initialized successfully")
            return True
        except Exception as e:
            self.logger.error(f"Failed to initialize WebDriver: {str(e)}")
            return False
    def handle_media_permissions(self):

        """
        Handles the media permissions popup by clicking 'Continue without microphone and camera'.
        """
        wait = WebDriverWait(self.driver, 10)
        try:
            time.sleep(2)
            continue_button_location = pyautogui.locateOnScreen('continue_without_media.png', confidence=0.8)
            if continue_button_location:
                x, y = pyautogui.center(continue_button_location)
                pyautogui.moveTo(x, y, duration=0.5)
                pyautogui.click()
                self.logger.info("Clicked 'Continue without microphone and camera' using PyAutoGUI")
                return True
        except Exception as pyautogui_error:
            self.logger.error(f"Failed to handle media permissions popup: {pyautogui_error}")
            return False

    def go_to_meet(self, meet_url):
        """
        Navigates directly to the Google Meet URL.
        """
        try:
            self.driver.get(meet_url)
            self.logger.info(f"Navigated to Google Meet URL: {meet_url}")

            time.sleep(2)
            self.handle_media_permissions()
            
            return True
        except Exception as e:
            self.logger.error(f"Failed to navigate to Google Meet URL: {str(e)}")


    def login(self, username, password):
        """
        Logs into Google using the provided username and password.
        Assumes that the driver is already on the Google Meet (login) page.
        """
        wait = WebDriverWait(self.driver, 15)
        try:
            # Wait for the email input field on the sign-in page (redirected from Google Meet)
            email_input = wait.until(EC.visibility_of_element_located((By.ID, "identifierId")))
            email_input.clear()
            email_input.send_keys(username)
            self.logger.info("Entered username")
            
            email_next = wait.until(EC.element_to_be_clickable((By.ID, "identifierNext")))
            email_next.click()
            self.logger.info("Clicked Next after entering email")
            
            # Wait for the password input field and enter the password
            password_input = wait.until(EC.visibility_of_element_located((By.XPATH, "//input[@type='password']")))
            password_input.clear()
            password_input.send_keys(password)
            self.logger.info("Entered password")
            
            password_next = wait.until(EC.element_to_be_clickable((By.ID, "passwordNext")))
            password_next.click()
            self.logger.info("Clicked Next after password")
            return True
        except Exception as e:
            self.logger.error(f"Error during login: {str(e)}")
            return False

    def join_meet(self):
        """
        Waits until the 'Ask to join' button is clickable and clicks it.
        This should be called after a successful login.
        """
        wait = WebDriverWait(self.driver, 15)
        try:
            # Allow additional time for the meeting page to load after login
            time.sleep(5)
            
            # Dismiss any overlay by pressing ESC using pyautogui
            pyautogui.press('esc')
            self.logger.info("Pressed ESC to dismiss potential overlays")
            
            # Wait until the "Ask to join" button is clickable and click it using Selenium
            ask_to_join_button = wait.until(EC.element_to_be_clickable((By.XPATH, "//span[contains(text(), 'Ask to join')]")))
            ask_to_join_button.click()
            self.logger.info("Clicked 'Ask to join' button via Selenium")
        except Exception as e:
            self.logger.error(f"Selenium failed to click 'Ask to join' button: {e}. Trying pyautogui as fallback.")
            # Fallback: use pyautogui to locate and click the button using the image template
            time.sleep(2)
            button_location = pyautogui.locateOnScreen(self.join_template_path, confidence=0.8)
            if button_location:
                x, y = pyautogui.center(button_location)
                pyautogui.moveTo(x, y, duration=0.5)
                pyautogui.click()
                self.logger.info("Clicked 'Ask to join' button via pyautogui")
            else:
                self.logger.error("Failed to locate 'Ask to join' button using pyautogui")

    def cleanup(self):
        """
        Closes the WebDriver/browser.
        """
        try:
            if self.driver:
                self.driver.quit()
                self.logger.info("Browser closed successfully")
        except Exception as e:
            self.logger.error(f"Error during cleanup: {str(e)}")

def main():
    # Update with valid credentials and the proper Google Meet URL.
    google_username = "5eun3isiyktv@gmail.com"
    google_password = "Iaminevitable"
    meet_url = input("Enter your Google Meet URL: ").strip()
    
    driver_path = r'C:\Users\ayo\Webdriver\msedgedriver.exe'
    join_template_path = r'C:\Users\ayo\MeetScript\ask_to_join.png' 
    
    meet_bot = GoogleMeetAutoLogin(driver_path=driver_path, join_template_path=join_template_path)

    if not meet_bot.setup_driver():
        print("WebDriver setup failed, aborting.")
        return

    # First navigate to the Google Meet URL.
    meet_bot.go_to_meet(meet_url)
  
    
    # Now log in on the page before the "Ask to join" button appears.
    if not meet_bot.login(google_username, google_password):
        print("Login failed, aborting.")
        meet_bot.cleanup()
        return

    # After successful login, wait for the meeting page and click "Ask to join".
    meet_bot.join_meet()
    
    # Optionally keep the browser open to see the meeting window
    time.sleep(10)
    meet_bot.cleanup()

if __name__ == "__main__":
    main()