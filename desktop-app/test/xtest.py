"""A real mouse and keyboard on an X display (XTest), for x11-pointer.mjs on
its virtual screen only.

Use:
  python3 -I xtest.py <display> move <x> <y>
  python3 -I xtest.py <display> click <x> <y> <button: 1 left, 3 right>
  python3 -I xtest.py <display> drag <x> <y> <dx> <dy>
  python3 -I xtest.py <display> escape
"""

import ctypes
import sys
import time

STEPS = 20
XK_ESCAPE = 0xFF1B
LEFT_BUTTON = 1


def load(display_name: str):
    x11 = ctypes.CDLL("libX11.so.6")
    xtest = ctypes.CDLL("libXtst.so.6")
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    x11.XKeysymToKeycode.restype = ctypes.c_ubyte
    xtest.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
    xtest.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    xtest.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]

    display = x11.XOpenDisplay(display_name.encode())
    if not display:
        sys.exit(f"cannot open display {display_name}")

    return x11, xtest, display


def main(argv: list[str]) -> None:
    x11, xtest, display = load(argv[1])

    def sent(ok: int, what: str) -> None:
        # 0 means the X server refused it (no XTEST, say): not the cat's fault.
        if not ok:
            sys.exit(f"XTest refused the {what}")
        x11.XSync(display, 0)

    def move(x: float, y: float) -> None:
        sent(xtest.XTestFakeMotionEvent(display, -1, round(x), round(y), 0), "pointer move")

    def button(number: int, down: bool) -> None:
        sent(xtest.XTestFakeButtonEvent(display, number, int(down), 0), "button")

    def key(keysym: int) -> None:
        code = x11.XKeysymToKeycode(display, keysym)
        if code == 0:
            sys.exit(f"no keycode for keysym {keysym:#x}")
        sent(xtest.XTestFakeKeyEvent(display, code, 1, 0), "key press")
        sent(xtest.XTestFakeKeyEvent(display, code, 0, 0), "key release")

    command, numbers = argv[2], [int(n) for n in argv[3:]]
    pressed = None
    try:
        if command == "move":
            move(*numbers)
        elif command == "click":
            x, y, number = numbers
            move(x, y)
            time.sleep(0.3)
            pressed = number
            button(number, True)
            time.sleep(0.1)
            button(number, False)
            pressed = None
        elif command == "drag":
            x, y, dx, dy = numbers
            move(x, y)
            time.sleep(0.3)
            pressed = LEFT_BUTTON
            button(LEFT_BUTTON, True)
            time.sleep(0.2)
            for step in range(1, STEPS + 1):
                move(x + dx * step / STEPS, y + dy * step / STEPS)
                time.sleep(0.03)
            time.sleep(0.2)
            button(LEFT_BUTTON, False)
            pressed = None
        elif command == "escape":
            key(XK_ESCAPE)
        else:
            sys.exit(f"unknown command {command}")
    finally:
        # Let go of the button even after an error, so none stays held down.
        if pressed is not None:
            xtest.XTestFakeButtonEvent(display, pressed, 0, 0)
            x11.XSync(display, 0)
        x11.XCloseDisplay(display)


if __name__ == "__main__":
    main(sys.argv)
