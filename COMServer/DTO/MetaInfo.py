from dataclasses import dataclass


@dataclass
class MetaInfo:
    min_len = 99999
    max_len = 0
    min_occ = 99999
    max_occ = 0
    total_word_count = 0
