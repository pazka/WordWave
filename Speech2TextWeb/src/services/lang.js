export const availableLangs = {
    'fr-FR': '🇫🇷 France',
    'en-UK': '🇬🇧 United Kingdom',
    'en-US': '🇺🇸 United States',
}

export function getCurrentLangOrDefault() : string{
    if(Object.keys(availableLangs).includes(navigator.language))
        return navigator.language
    else 
        return Object.keys(availableLangs)[0]
}