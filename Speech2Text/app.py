# From tuto : https://www.thepythoncode.com/article/using-speech-recognition-to-convert-speech-to-text-python

import speech_recognition as sr 
import os 
from pydub import AudioSegment
from pydub.silence import split_on_silence
import socket
import sys
import time

is_debug = "debug" in sys.argv
# create a speech recognition object
r = sr.Recognizer()

HOST = 'localhost'
PORT = 9234

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

client.connect((HOST, PORT))
print("connexion succefull")

def send_words(message):
    print(f'Envoi de :' + message)
    bytes = message.encode("utf-8")
    print(f'Connexion vers ' + HOST + ':' + str(PORT) + ' reussie.')
    n = client.send(bytes)
    if (n != len(bytes)):
            print(f'Erreur envoi.')
    else:
            print(f'Envoi ok.')

errors = 0

count = 1
def debug():
    global count
    send_words(f"test {count}" )
    count += 1 

while errors < 3:
    if is_debug :
        debug()
        time.sleep(1)
        continue
    try:
        with sr.Microphone() as source:
            # read the audio data from the default microphone
            print("I'm listening ...")
            audio_data = r.record(source, duration=5)
            print("Recognizing...")
            # convert speech to text
            text = r.recognize_google(audio_data,language="en-US")
            print(text)
            send_words(text)
            errors = 0
    except Exception as e:
        errors += 1
        print(e)

client.close()