import os
import re
import threading
from datetime import datetime

from DTO.MetaInfo import MetaInfo


class WordProcessor:
    def __init__(self, path=None):
        curr_path = os.path.dirname(os.path.abspath(__file__))
        if path and path != "":
            self._log_file = open(path, 'a+', encoding="utf-8")
        else:
            self._log_file = open(
                f'{curr_path}/{datetime.now().strftime("%m%d%Y_%H%M%S")}.words', 'a+', encoding="utf-8")
        self._log_file.flush()

        self.mutex = threading.Lock()
        self.current_registered = ""
        self.current_words = {}
        self.meta = MetaInfo()
        self.excluded_words = []

        with open(f"{curr_path}/dictionnaries/excluded_words_full", "r", encoding="utf-8") as f:
            to_exclude = self.normalize_text(' '.join(f.readlines()))
            self.excluded_words = to_exclude.split(' ')

        if path and path != "":
            text = self._log_file.readlines()
            self.register_text('\n'.join(text))

    def destroy(self):
        self._log_file.close()

    def safe_log(self, text):
        self.mutex.acquire()
        self._log_file.write(text)
        self._log_file.flush()
        self.mutex.release()

    def safe_log_read(self):
        self.mutex.acquire()
        self._log_file.seek(0, 0)
        logs = '\n'.join(self._log_file.readlines())
        self.mutex.release()
        return logs

    def should_ignore_word(self, word):
        return word == "" or word in self.excluded_words

    def add_excluded_text(self, text: str):
        words = self.normalize_text(text).split(' ')

        # update internal excluding dict
        for word in words:
            if word in self.excluded_words:
                continue

            self.excluded_words.append(word)

        # exclude current word with new dict
        new_current_words = {}
        for word, count in self.current_words.items():
            if word in self.excluded_words:
                continue
            new_current_words[word] = count

        self.current_words = new_current_words
        self.update_meta()

    def normalize_text(self, text):
        # replace multiple spaces, multiple non-word char, line return

        normalized_text = text.lower()
        normalized_text = re.sub(r'\t+|(\n\r)+|[\n\r]+|[^a-zA-Zàâäéèêëïîôöùûüÿç\s]+', ' ', normalized_text)
        normalized_text = re.sub(r'\s{2,}', ' ', normalized_text)

        return normalized_text

    def register_text(self, text):
        """
            @return: dict grouped total count of words in this sentence
        """
        self.safe_log(text)
        registered_text = ""
        normalized_text = self.normalize_text(text)

        word_counted = {}
        for word in normalized_text.split(' '):
            if self.should_ignore_word(word):
                continue

            if word not in self.current_words:
                self.current_words[word] = 0

            self.current_words[word] += 1
            word_counted[word] = self.current_words[word]
            registered_text += " " + word

        self.update_meta()

        # log registered
        self.current_registered += registered_text + '\n'
        return [word_counted, registered_text]

    def update_meta(self):
        self.meta = MetaInfo()
        self.meta.total_word_count = len(self.current_words)

        for word, count in self.current_words.items():
            if len(word) < self.meta.min_len:
                self.meta.min_len = len(word)

            if len(word) > self.meta.max_len:
                self.meta.max_len = len(word)

            if count < self.meta.min_occ:
                self.meta.min_occ = self.current_words[word]

            if count > self.meta.max_occ:
                self.meta.max_occ = self.current_words[word]
