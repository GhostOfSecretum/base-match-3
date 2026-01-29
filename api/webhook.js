// Webhook endpoint for Base Mini App notifications
// This endpoint receives events from Base when users interact with the app

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Handle GET request (for health checks)
  if (req.method === 'GET') {
    return res.status(200).json({
      success: true,
      message: 'Base Match-3 webhook is active',
      timestamp: new Date().toISOString()
    });
  }

  // Handle POST request (actual webhook events)
  if (req.method === 'POST') {
    try {
      const event = req.body;
      
      console.log('Webhook event received:', JSON.stringify(event, null, 2));
      
      // Process different event types
      if (event.type === 'mini_app_added') {
        console.log('Mini app was added by user:', event.data?.fid);
      } else if (event.type === 'mini_app_removed') {
        console.log('Mini app was removed by user:', event.data?.fid);
      } else if (event.type === 'notification_enabled') {
        // event.data может содержать: fid, token, url — сохраните в БД для отправки уведомлений от имени мини-аппки
        console.log('Notifications enabled by user fid:', event.data?.fid);
        if (event.data?.token) {
          // TODO: сохранить event.data (fid, token, url) в БД для self-hosted рассылки
          console.log('Notification token received (store in DB for sending)');
        }
      } else if (event.type === 'notification_disabled') {
        console.log('Notifications disabled by user:', event.data?.fid);
        // TODO: пометить токен недействительным или удалить из БД
      }
      
      // Always respond quickly with success
      return res.status(200).json({
        success: true,
        received: true
      });
    } catch (error) {
      console.error('Webhook error:', error);
      return res.status(200).json({
        success: true,
        received: true
      });
    }
  }

  // Method not allowed
  return res.status(405).json({
    success: false,
    error: 'Method not allowed'
  });
}
