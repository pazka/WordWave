export class WordMeta {
    // @ts-ignore
    min_len: Number.MAX_VALUE
    max_len: 0
    // @ts-ignore
    min_occ: Number.MAX_VALUE
    max_occ: 0
    total_word_counted : 0
    total_word_registered : 0
}

export class WordData{
    words : Record<string,number> // word : nbOccurence
    meta : WordMeta
}