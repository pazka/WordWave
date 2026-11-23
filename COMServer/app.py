import os
import signal
import sys

import AdminSetup
import ServerCom
from config import init_config, get_config
from jsonlog import LOG
from WordProcessor import WordProcessor


def signal_handler(sig, frame):
    # One shutdown line, then exit 0. Installed BEFORE the blocking run (it used to come after it, so it was never
    # set, and SIGTERM, which docker stop sends, was not handled). The word log is flushed on every write.
    LOG.info("shutdown", "Shutting down", signal=signal.Signals(sig).name)
    sys.exit(0)


init_config(os.path.dirname(os.path.abspath(__file__))+'/config.json')
word_processor = WordProcessor(get_config('word_file'))
ServerCom.init(word_processor)
AdminSetup.init()
signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)
ServerCom.run()
