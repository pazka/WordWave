# From tuto : https://www.thepythoncode.com/article/using-speech-recognition-to-convert-speech-to-text-python

import speech_recognition as sr 
import os 
from pydub import AudioSegment
from pydub.silence import split_on_silence
import socket

# create a speech recognition object
r = sr.Recognizer()



HOST = 'localhost'
PORT = 9234

client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

def send_words(message):
    print(f'Envoi de :' + message)
    bytes = message.encode("utf-8")
    client.connect((HOST, PORT))
    print(f'Connexion vers ' + HOST + ':' + str(PORT) + ' reussie.')
    n = client.send(bytes)
    if (n != len(bytes)):
            print(f'Erreur envoi.')
    else:
            print(f'Envoi ok.')
    client.close()

while True:
    with sr.Microphone() as source:
        # read the audio data from the default microphone
        audio_data = r.record(source, duration=5)
        print("Recognizing...")
        # convert speech to text
        text = r.recognize_google(audio_data)
        print(text)
        send_words(text)


