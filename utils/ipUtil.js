// utils/ipUtil.js
const axios = require('axios');

const getPublicIP = async () => {
  try {
    // Using ipify API to get public IP
    const response = await axios.get('https://api.ipify.org?format=json');
    return response.data.ip;
  } catch (error) {
    console.error('Error fetching public IP:', error);
    throw error;
  }
};

module.exports = { getPublicIP };