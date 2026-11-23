# Awqat

**Snap prayer time.** Point your camera at any prayer timetable and Awqat reads the adhan and iqama times with AI, saves them on your phone, and reminds you at each prayer.

A home-screen web app (PWA): open it in Safari or Chrome and choose *Add to Home Screen*.

## Features
- Snap any prayer timetable → AI reads it → you check it → saved as your prayer times
- Calculated times for every Nigerian state (or your exact location) when you have no snap
- Alarms: notifications, calendar alerts (.ics), and Android Clock alarms
- Qur'an: surah reader (Arabic + English) and the Madani 604-page Mushaf; Mushaf Maki coming
- Hadith (Nawawi, Bukhari, Muslim, Abu Dawud, Tirmidhi), Sirah timeline, Duas & adhkar
- Tasbih, the 99 Names, Hijri calendar with Sunnah fasts, Zakat calculator, Qibla compass
- Islamic news and YouTube videos
- Four themes: **Sky** (colour follows the prayer), **Clay**, **Ink & Brass**, **Paper**

## Run locally
```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## Deploy
GitHub Pages serves this repo as-is (Settings → Pages → Deploy from branch → `main` / root).
The AI reader, news and videos need the Cloudflare worker; see [`worker/README.md`](worker/README.md).

## Data sources
Prayer calculation: [adhan-js](https://github.com/batoulapps/adhan-js) (MIT) · Qur'an: [alquran.cloud](https://alquran.cloud) · Hadith: [hadith-api](https://github.com/fawazahmed0/hadith-api)
