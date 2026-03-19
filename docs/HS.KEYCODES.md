# Hammerspoon Key Code Reference

Key strings for use in `hs.hotkey.bind()` calls in `init.lua`.

## Letters

|     |     |     |     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `a` | `b` | `c` | `d` | `e` | `f` | `g` | `h` | `i` | `j` | `k` | `l` | `m` |
| `n` | `o` | `p` | `q` | `r` | `s` | `t` | `u` | `v` | `w` | `x` | `y` | `z` |

## Numbers

|     |     |     |     |     |     |     |     |     |     |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `0` | `1` | `2` | `3` | `4` | `5` | `6` | `7` | `8` | `9` |

## Symbols

| Key     | Description               |
| ------- | ------------------------- |
| `` ` `` | Backtick / grave accent   |
| `-`     | Hyphen / minus            |
| `=`     | Equals                    |
| `[`     | Left bracket              |
| `]`     | Right bracket             |
| `\`     | Backslash                 |
| `;`     | Semicolon                 |
| `'`     | Apostrophe / single quote |
| `,`     | Comma                     |
| `.`     | Period                    |
| `/`     | Forward slash             |

## Function Keys

|      |      |      |      |      |      |      |      |      |       |       |       |       |       |       |       |       |       |       |       |
| ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- |
| `f1` | `f2` | `f3` | `f4` | `f5` | `f6` | `f7` | `f8` | `f9` | `f10` | `f11` | `f12` | `f13` | `f14` | `f15` | `f16` | `f17` | `f18` | `f19` | `f20` |

## Numpad

| Key             | Description          |
| --------------- | -------------------- |
| `pad0` – `pad9` | Numpad digits        |
| `pad.`          | Numpad decimal point |
| `pad+`          | Numpad plus          |
| `pad-`          | Numpad minus         |
| `pad*`          | Numpad multiply      |
| `pad/`          | Numpad divide        |
| `pad=`          | Numpad equals        |
| `padclear`      | Numpad clear         |
| `padenter`      | Numpad enter         |

## Navigation & Control

| Key             | Description        |
| --------------- | ------------------ |
| `return`        | Return / Enter     |
| `tab`           | Tab                |
| `space`         | Space              |
| `delete`        | Delete (backspace) |
| `forwarddelete` | Forward delete     |
| `escape`        | Escape             |
| `help`          | Help               |
| `home`          | Home               |
| `end`           | End                |
| `pageup`        | Page Up            |
| `pagedown`      | Page Down          |

## Arrow Keys

|        |         |      |        |
| ------ | ------- | ---- | ------ |
| `left` | `right` | `up` | `down` |

## Modifiers

| Key          | Description          |
| ------------ | -------------------- |
| `cmd`        | Command (left)       |
| `rightcmd`   | Command (right)      |
| `shift`      | Shift (left)         |
| `rightshift` | Shift (right)        |
| `alt`        | Option / Alt (left)  |
| `rightalt`   | Option / Alt (right) |
| `ctrl`       | Control (left)       |
| `rightctrl`  | Control (right)      |
| `capslock`   | Caps Lock            |
| `fn`         | Function (Fn)        |

## JIS Keys (Japanese layout)

| Key          | Description        |
| ------------ | ------------------ |
| `yen`        | Yen sign `¥`       |
| `underscore` | Underscore (JIS)   |
| `pad,`       | Numpad comma (JIS) |
| `eisu`       | Eisu (英数)        |
| `kana`       | Kana (かな)        |

---

> Source: `hs.keycodes.map` — the bidirectional keycode↔name table built into Hammerspoon.
> Use `hs.keycodes.map` in the Hammerspoon console to inspect the full live table.
