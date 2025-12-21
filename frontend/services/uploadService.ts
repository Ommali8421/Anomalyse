// Future Backend API Contracts:
// POST /api/v1/transactions/upload

export const uploadService = {
  uploadCSV: async (file: File): Promise<{ success: boolean; message: string; rowsProcessed: number }> => {
    const token = localStorage.getItem('anomalyse_token');
    console.log('Token from localStorage in uploadService:', token);
    const formData = new FormData();
    formData.append('file', file);

    const resp = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      body: formData
    });
    if (!resp.ok) {
      const msg = await resp.text();
      throw new Error(msg || 'Upload failed');
    }
    return await resp.json();
  }
};
