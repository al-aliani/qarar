/**
 * انتهاء الجلسة تلقائياً بعد فترة خمول (30 دقيقة)
 * يظهر تنبيهاً ثم يستدعي onIdle (مثلاً تسجيل خروج).
 */
const IDLE_MS = 30 * 60 * 1000; // 30 دقيقة
const WARN_BEFORE_MS = 60 * 1000; // تنبيه قبل دقيقة واحدة

let _timer = null;
let _warnTimer = null;
let _onIdle = null;
let _onWarn = null;

function reset() {
    if (_timer) clearTimeout(_timer);
    if (_warnTimer) clearTimeout(_warnTimer);
    _timer = setTimeout(() => {
        if (_onWarn) _onWarn();
        _warnTimer = setTimeout(() => {
            if (_onIdle) _onIdle();
            stop();
        }, WARN_BEFORE_MS);
    }, IDLE_MS - WARN_BEFORE_MS);
}

function stop() {
    if (_timer) clearTimeout(_timer);
    if (_warnTimer) clearTimeout(_warnTimer);
    _timer = _warnTimer = null;
}

/**
 * @param {{ onIdle: () => void, onWarn?: () => void }} options
 * @returns { () => void } stop
 */
export function startIdleTimeout(options = {}) {
    _onIdle = options.onIdle || null;
    _onWarn = options.onWarn || null;
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(ev => document.addEventListener(ev, reset));
    reset();
    return stop;
}
