# 🛡️ Anomalyse - Fraud Detection System

[![FastAPI](https://img.shields.io/badge/FastAPI-005571?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Machine Learning](https://img.shields.io/badge/Machine_Learning-FF6F00?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org/)

**Anomalyse** is a modern, full-stack fraud detection and transaction monitoring platform. It combines a powerful **FastAPI** backend with a sophisticated **Machine Learning** pipeline and a beautiful **React** dashboard to help bank analysts identify and investigate suspicious financial activities in real-time.

---

## ✨ Key Features

- 📊 **Real-time Dashboard**: Overview of fraud metrics, risk distribution, and trends.
- 🔍 **Transaction Monitoring**: Detailed list of transactions with ML-powered risk scores.
- 🚩 **Flag Analysis**: Automated reasoning for flagged transactions (Velocity, Amount, Location, etc.).
- 📁 **Batch Ingestion**: Upload CSV files for instant batch analysis and fraud prediction.
- 🔐 **Secure Authentication**: Role-based access control for bank analysts.
- 🤖 **ML Integration**: Scikit-learn pipeline for accurate anomaly detection.

---

## 🛠️ Tech Stack

### **Backend**
- **Framework**: FastAPI (Python)
- **Database**: SQLite with SQLAlchemy ORM
- **ML Engine**: Scikit-learn, Pandas, Joblib
- **Security**: JWT Authentication, Bcrypt Password Hashing

### **Frontend**
- **Library**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Charts**: Recharts

---

## 🚀 Getting Started

Follow these steps to get the project running on your local machine.

### **Prerequisites**
- **Python 3.9+**
- **Node.js 18+**
- **Git**

### **1. Clone the Repository**
```bash
git clone https://github.com/Ommali8421/Anomalyse_1.git
cd Anomalyse-main
```

### **2. Backend Setup**
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # Windows
   python -m venv venv
   .\venv\Scripts\activate

   # macOS/Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Initialize the database and seed data:
   ```bash
   python migrate_and_seed.py
   ```
5. Start the backend server:
   ```bash
   uvicorn main:app --reload
   ```
   *The API will be available at `http://localhost:8000`*

### **3. Frontend Setup**
1. Open a new terminal and navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
   *The application will be available at `http://localhost:5173`*

---

## 🔑 Login Credentials

Use the following credentials to access the analyst dashboard:

- **Email**: `analyst@anomalyse.bank`
- **Password**: `password123`

---

## 📂 Project Structure

```text
Anomalyse/
├── backend/               # FastAPI Server
│   ├── model/             # ML Pipeline & Preprocessing
│   ├── main.py            # API Endpoints
│   ├── models.py          # Database Schema
│   └── migrate_and_seed.py # DB Initialization
├── frontend/              # React Application
│   ├── src/               # UI Components & Pages
│   ├── services/          # API Integration
│   └── types.ts           # TypeScript Definitions
└── README.md              # Documentation
```

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Developed with ❤️ for secure banking.
