let isSupported: boolean = true
let wakeLock: any = null

const navigator: any = window.navigator

if (!navigator.wakeLock) {
    isSupported = false;
}

export async function tryKeepAwake() {
    if (!isSupported) {
        console.error("Can't keep awake because wakeLock not in navigator",navigator,navigator.wakeLock)
        return
    }

    // create an async function to request a wake lock
    try {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('[WAKE] Wake Lock is active!')

        wakeLock.addEventListener('release', () => {
            // the wake lock has been released
            console.log('[WAKE] Wake Lock has been released')
        });

        document.addEventListener('visibilitychange', async () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                wakeLock = await navigator.wakeLock.request('screen');
            }
        });
    } catch (err) {
        console.log("[WAKE] Wake Lock couldn't activate!")
        // The Wake Lock request has failed - usually system related, such as battery.
        console.error(err)
    }
}

export async function stopKeepAwake() {
    return wakeLock.release()
        .then(() => {
            wakeLock = null;
        });
}
