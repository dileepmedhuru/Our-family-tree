# 🌳 Medhuru Family Tree

A beautifully designed, responsive family tree web application built using **Vanilla JavaScript** and **Firebase Realtime Database**.  
The app allows families to manage generations, upload photos, set birthday reminders, reorder members, and explore family branches in an elegant interactive UI.

---

## ✨ Features

✅ Multi-generation family tree  
✅ Real-time Firebase synchronization  
✅ Offline support using localStorage  
✅ Photo upload with crop & zoom  
✅ Birthday reminders & notification banners  
✅ Live member search with instant navigation  
✅ Drag-and-drop/touch reordering  
✅ Spouse linking support  
✅ Responsive dark-themed UI  
✅ Mobile-friendly experience  

---

## 📸 Preview

### 🖥️ Main Family Tree UI
- Elegant dark interface with gold accents
- Dynamic member cards
- Smooth animations and transitions

### 📱 Mobile Responsive
- Fully optimized for mobile devices
- Touch drag support
- Adaptive layouts

---

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| HTML5 | Structure |
| CSS3 | Styling & Animations |
| Vanilla JavaScript | Frontend Logic |
| Firebase Realtime Database | Cloud Database |
| localStorage | Offline Backup |
| Google Fonts | Typography |
| Tabler Icons | Icons |

---

# 📁 Project Structure

```bash
myfamilytree/
│
├── assets/
│   ├── css/
│   │   └── style.css
│   │
│   ├── fonts/
│   │
│   └── js/
│       ├── alarms.js
│       ├── app.js
│       ├── config.example.js
│       ├── config.js
│       ├── members.js
│       ├── photos.js
│       ├── reorder.js
│       └── search.js
│
├── public/
│
├── venv/
│
├── .gitignore
│
└── index.html
```

---

# 🚀 Getting Started

## 1️⃣ Clone Repository

```bash
git clone https://github.com/your-username/myfamilytree.git
cd myfamilytree
```

---

## 2️⃣ Setup Firebase

### Create Firebase Project
- Open Firebase Console
- Create a new project
- Enable **Realtime Database**

### Configure Database Rules

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

---

## 3️⃣ Configure Firebase Keys

Copy:

```bash
cp assets/js/config.example.js assets/js/config.js
```

Add your Firebase credentials inside:

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "YOUR_DATABASE_URL",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_BUCKET",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

> ⚠️ `config.js` is gitignored for security purposes.

---

# ▶️ Run the Project

## Option 1 — Open Directly
Simply open:

```bash
index.html
```

in your browser.

---

## Option 2 — Run Local Server (Recommended)

### Python

```bash
python -m http.server 8080
```

### Node.js

```bash
npx serve .
```

Open:

```bash
http://localhost:8080
```

---

# 🎯 Core Functionalities

| Feature | Description |
|---|---|
| Add Members | Add family members dynamically |
| Edit/Delete | Modify member information |
| Upload Photos | Crop and zoom profile pictures |
| Birthday Alarms | Notifications for upcoming birthdays |
| Search | Instant search & navigation |
| Reorder | Drag cards to reorder children |
| Spouse Linking | Connect spouses visually |
| Offline Backup | localStorage fallback support |

---

# 🔒 Security Notes

- Firebase credentials are excluded using `.gitignore`
- Configure production Firebase security rules before deployment
- Large image storage should use Firebase Storage instead of Base64

---

# 🌐 Deployment

You can deploy easily on:

- Netlify ( I used this )
- Vercel
- Firebase Hosting
- GitHub Pages

---

# 🤝 Contributing

Pull requests are welcome.  
For major changes, please open an issue first.

---

# 📄 License

MIT License © Medhuru Family

---

# ❤️ Developed By

**Medhuru Dileep**  
AI & Data Science Student  
Passionate about building real-world intelligent applications 🚀
