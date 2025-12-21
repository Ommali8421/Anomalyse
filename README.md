# Anomalyse - Fraud Detection System

Anomalyse is a professional banking fraud detection interface built with React, TypeScript, and Tailwind CSS. It visualizes suspicious transactions and provides an interface for analysts to review potential fraud.

## Prerequisites

Before running this project, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (Version 16 or higher)
- [VS Code](https://code.visualstudio.com/)

## Installation

1.  **Clone or Download** this repository to your local machine.
2.  **Open** the project folder in VS Code.
3.  **Install Dependencies** by running the following command in the terminal:
    ```bash
    npm install
    ```

## Running the Application

To start the local development server:

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

## Project Structure

- **src/** (Root in this setup): Contains all source code.
    - **components/**: Reusable UI components (Layout, ProtectedRoute).
    - **pages/**: Main application screens (Dashboard, Transactions, Upload).
    - **services/**: Mock services simulating backend API calls.
    - **types.ts**: TypeScript interfaces for data models.
- **index.html**: Entry point for the application.

## Tech Stack

- **React 18**: UI Library
- **Vite**: Build tool and development server
- **TypeScript**: Static typing
- **Recharts**: Data visualization and charts
- **Tailwind CSS**: Utility-first CSS framework (via CDN for simplicity)
- **React Router**: Client-side routing
- **Lucide React**: Icon set
