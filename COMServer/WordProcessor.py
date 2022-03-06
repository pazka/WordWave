import re
import threading
from datetime import datetime


class WordProcessor:
    def __init__(self, path=None):
        if path and path != "":
            self._log_file = open(path, 'a+', encoding="utf-8")
        else:
            self._log_file = open(
                f'words_{datetime.now().strftime("%m%d%Y_%H%M%S")}', 'a+', encoding="utf-8")
        self._log_file.flush()

        self.mutex = threading.Lock()
        self.current_logs = ""
        self.current_words = {}
        self.meta = {
            "min_len": 999,
            "max_len": 0,
            "min_occ": 99999,
            "max_occ": 0,
            "total_word_count": 0
        }

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

    def get_all_logs(self):
        return self.current_logs

    def get_all_words(self):
        return self.current_logs.replace('\n', ' ')

    def get_all_uniq_words(self):
        return ' '.join(self.current_words.keys())

    def should_ignoe_word(self,word):
        return word == ""

    def register_text(self, text):
        """
            :return dict: grouped total count of words in this sentence
        """
        normalized_text = re.sub(r'(\n\r)|[\n\r]|\s{2,}|[^\w]', ' ', text)
        normalized_text = normalized_text.lower()
        self.safe_log(normalized_text)
        self.current_logs += normalized_text + '\n'

        word_counted = {}
        for word in normalized_text.split(' '):
            if self.should_ignore_word(word):
                continue

            self.register_word(word)
            word_counted[word] = self.current_words[word]

        return [word_counted, normalized_text]

    def register_word(self, word):
        if word not in self.current_words:
            self.current_words[word] = 0

        self.current_words[word] += 1
        self.meta["total_word_count"] = len(self.current_words)

        if len(word) < self.meta['min_len']:
            self.meta['min_len'] = len(word)

        if len(word) > self.meta["max_len"]:
            self.meta['max_len'] = len(word)

        if self.current_words[word] < self.meta["min_occ"]:
            self.meta['min_occ'] = self.current_words[word]

        if self.current_words[word] > self.meta["max_occ"]:
            self.meta['max_occ'] = self.current_words[word]

"""
    TODO : 
        - Word exclusion
        - Remove underspoken words (<2 occ for exemple)
        - Linearize position function invert of power
"""