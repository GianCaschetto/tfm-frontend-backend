import express from 'express';
import { requireAdminAccess } from './middleware/auth.js';
import { processMessage, getConversations, getConversation, deleteConversation } from './services/agent/agentService.js';

const router = express.Router();

router.post('/chat', requireAdminAccess, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Se requiere un mensaje' });
    }

    const businessId = req.query.business;
    const result = await processMessage(businessId, req.user, conversationId, message.trim());
    res.json(result);
  } catch (error) {
    console.error('Agent chat error:', error);

    if (error.status === 429 || error.message?.includes('429')) {
      const retryMatch = error.message?.match(/retry in ([\d.]+)/i);
      const retryAfter = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) : 60;
      return res.status(429).json({
        error: 'quota_exceeded',
        message: 'Se agotaron los tokens disponibles del agente de IA. Por favor, intenta de nuevo en unos minutos.',
        retryAfterSeconds: retryAfter
      });
    }

    res.status(500).json({ error: 'Error procesando el mensaje', details: error.message });
  }
});

router.get('/conversations', requireAdminAccess, async (req, res) => {
  try {
    const businessId = req.query.business;
    const conversations = await getConversations(businessId, req.user.uid);
    res.json({ conversations });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({ error: 'Error obteniendo conversaciones' });
  }
});

router.get('/conversations/:id', requireAdminAccess, async (req, res) => {
  try {
    const businessId = req.query.business;
    const conversation = await getConversation(req.params.id, businessId, req.user.uid);
    if (!conversation) {
      return res.status(404).json({ error: 'Conversación no encontrada' });
    }
    res.json({ conversation });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({ error: 'Error obteniendo conversación' });
  }
});

router.delete('/conversations/:id', requireAdminAccess, async (req, res) => {
  try {
    const businessId = req.query.business;
    await deleteConversation(req.params.id, businessId, req.user.uid);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({ error: 'Error eliminando conversación' });
  }
});

export default router;
