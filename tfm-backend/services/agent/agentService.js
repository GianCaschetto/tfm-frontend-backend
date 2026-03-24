import Conversation from '../../models/Conversation.js';
import Settings from '../../models/Settings.js';
import Branch from '../../models/Branch.js';
import { selectOllamaTools, isCriticalAction, getRequiredPermission } from './actionRegistry.js';
import { executeAction, buildConfirmationDescription } from './actionExecutor.js';
import { buildSystemPrompt } from './systemPrompt.js';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1:8b';

async function ollamaChat(messages, tools = null) {
  const body = { model: OLLAMA_MODEL, messages, stream: false };
  if (tools?.length) body.tools = tools;

  const res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Ollama error ${res.status}: ${text}`);
  }

  return res.json();
}

const CONFIRMATION_PHRASES = ['sí', 'si', 'confirmo', 'confirmar', 'dale', 'ok', 'hazlo', 'adelante', 'procede', 'yes', 'confirm', 'ejecuta', 'sí, confirma', 'si confirma'];
const CANCEL_PHRASES = ['no', 'cancelar', 'cancela', 'no quiero', 'olvídalo', 'olvidalo', 'cancel', 'detente', 'para', 'no, cancela'];

function isConfirmation(text) {
  const normalized = text.trim().toLowerCase().replace(/[.,!?¿¡]/g, '');
  return CONFIRMATION_PHRASES.some(p => normalized === p || normalized.startsWith(p));
}

function isCancellation(text) {
  const normalized = text.trim().toLowerCase().replace(/[.,!?¿¡]/g, '');
  return CANCEL_PHRASES.some(p => normalized === p || normalized.startsWith(p));
}

async function getBusinessContext(businessId) {
  const settings = await Settings.findOne({ businessId });
  const branches = await Branch.find({ businessId, isActive: true });
  return {
    businessName: settings?.general?.restaurantName || businessId,
    currency: settings?.general?.currency || 'USD',
    branches: branches.map(b => ({ id: b.id, name: b.name, address: b.address }))
  };
}

function conversationToOllamaMessages(systemPrompt, messages) {
  const ollamaMessages = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    if (msg.role === 'user') {
      ollamaMessages.push({ role: 'user', content: msg.content });
    } else     if (msg.role === 'model') {
      if (msg.functionCall?.name) {
        ollamaMessages.push({
          role: 'assistant',
          content: '',
          tool_calls: [{
            id: `call_${msg.functionCall.name}_${Date.now()}`,
            type: 'function',
            function: {
              name: msg.functionCall.name,
              arguments: msg.functionCall.args || {},
            }
          }]
        });
      } else {
        ollamaMessages.push({ role: 'assistant', content: msg.content || '' });
      }
    } else if (msg.role === 'function') {
      ollamaMessages.push({
        role: 'tool',
        content: JSON.stringify(msg.functionResponse?.response || {}),
      });
    }
  }

  return ollamaMessages;
}

function extractToolCall(response) {
  const toolCalls = response.message?.tool_calls;
  if (!toolCalls?.length) return null;
  const call = toolCalls[0];
  return {
    name: call.function.name,
    args: typeof call.function.arguments === 'string'
      ? JSON.parse(call.function.arguments)
      : call.function.arguments || {},
  };
}

export async function processMessage(businessId, user, conversationId, message) {
  let conversation;
  if (conversationId) {
    conversation = await Conversation.findOne({ _id: conversationId, businessId, userId: user.uid });
    if (!conversation) {
      throw new Error('Conversación no encontrada');
    }
  } else {
    conversation = new Conversation({
      businessId,
      userId: user.uid,
      title: message.substring(0, 60),
      messages: [],
      isActive: true
    });
  }

  // ─── Handle pending confirmation ───
  if (conversation.pendingAction) {
    const pending = conversation.pendingAction;

    if (isConfirmation(message)) {
      conversation.messages.push({ role: 'user', content: message });

      const result = await executeAction(pending.actionType, businessId, pending.params);

      conversation.messages.push({
        role: 'model',
        content: '',
        functionCall: { name: pending.actionType, args: pending.params }
      });
      conversation.messages.push({
        role: 'function',
        functionResponse: { name: pending.actionType, response: result }
      });

      conversation.pendingAction = null;

      const businessContext = await getBusinessContext(businessId);
      const systemPrompt = buildSystemPrompt(businessContext);
      const ollamaMessages = conversationToOllamaMessages(systemPrompt, conversation.messages);
      ollamaMessages.push({
        role: 'user',
        content: `La acción "${pending.actionType}" se ejecutó exitosamente. Resultado: ${JSON.stringify(result)}. Explica brevemente al usuario qué se hizo.`
      });

      const ollamaResponse = await ollamaChat(ollamaMessages);
      const explanation = ollamaResponse.message?.content || 'Acción ejecutada correctamente.';

      conversation.messages.push({ role: 'user', content: `La acción "${pending.actionType}" se ejecutó exitosamente. Resultado: ${JSON.stringify(result)}. Explica brevemente al usuario qué se hizo.` });
      conversation.messages.push({ role: 'model', content: explanation });

      await conversation.save();
      return {
        conversationId: conversation._id,
        response: explanation,
        actionExecuted: { type: pending.actionType, result }
      };
    }

    if (isCancellation(message)) {
      conversation.messages.push({ role: 'user', content: message });
      conversation.messages.push({ role: 'model', content: `Acción cancelada: ${pending.description}` });
      conversation.pendingAction = null;
      await conversation.save();
      return {
        conversationId: conversation._id,
        response: `De acuerdo, he cancelado la acción. ${pending.description.split('.')[0]} no se ejecutó.`
      };
    }

    conversation.pendingAction = null;
    conversation.messages.push({
      role: 'model',
      content: 'Se descartó la acción pendiente porque el usuario envió un nuevo mensaje.'
    });
  }

  // ─── Normal flow: send to Ollama ───
  conversation.messages.push({ role: 'user', content: message });

  const businessContext = await getBusinessContext(businessId);
  const systemPrompt = buildSystemPrompt(businessContext);

  const ollamaMessages = conversationToOllamaMessages(
    systemPrompt,
    conversation.messages.slice(0, -1)
  );
  ollamaMessages.push({ role: 'user', content: message });

  const tools = selectOllamaTools(message);
  let response = await ollamaChat(ollamaMessages, tools);
  let maxIterations = 5;

  while (maxIterations-- > 0) {
    const toolCall = extractToolCall(response);

    if (!toolCall) {
      const textContent = response.message?.content || '';
      conversation.messages.push({ role: 'model', content: textContent });
      await conversation.save();
      return { conversationId: conversation._id, response: textContent };
    }

    const { name: actionName, args: actionArgs } = toolCall;

    // Check permissions
    const requiredPermission = getRequiredPermission(actionName);
    if (requiredPermission && !user.hasPermission(requiredPermission)) {
      const permError = `No tienes permiso para ejecutar esta acción. Se requiere: ${requiredPermission}`;
      conversation.messages.push({ role: 'model', content: permError });
      await conversation.save();
      return { conversationId: conversation._id, response: permError };
    }

    // Critical action -> request confirmation
    if (isCriticalAction(actionName)) {
      const description = await buildConfirmationDescription(actionName, businessId, actionArgs);

      conversation.messages.push({
        role: 'model',
        content: '',
        functionCall: { name: actionName, args: actionArgs }
      });

      conversation.pendingAction = {
        actionType: actionName,
        params: actionArgs,
        description
      };
      await conversation.save();

      return {
        conversationId: conversation._id,
        response: `⚠️ **Acción crítica detectada**\n\n${description}\n\n¿Confirmas esta acción? (Responde "sí" para confirmar o "no" para cancelar)`,
        pendingConfirmation: true,
        actionType: actionName
      };
    }

    // Non-critical: execute immediately
    conversation.messages.push({
      role: 'model',
      content: '',
      functionCall: { name: actionName, args: actionArgs }
    });

    const actionResult = await executeAction(actionName, businessId, actionArgs);

    conversation.messages.push({
      role: 'function',
      functionResponse: { name: actionName, response: actionResult }
    });

    const updatedMessages = conversationToOllamaMessages(systemPrompt, conversation.messages);
    response = await ollamaChat(updatedMessages, tools);
  }

  const fallback = 'Se alcanzó el límite de iteraciones. Por favor, intenta de nuevo con una solicitud más simple.';
  conversation.messages.push({ role: 'model', content: fallback });
  await conversation.save();
  return { conversationId: conversation._id, response: fallback };
}

export async function getConversations(businessId, userId) {
  return Conversation.find({ businessId, userId, isActive: true })
    .select('_id title updatedAt pendingAction')
    .sort({ updatedAt: -1 })
    .limit(50);
}

export async function getConversation(conversationId, businessId, userId) {
  return Conversation.findOne({ _id: conversationId, businessId, userId });
}

export async function deleteConversation(conversationId, businessId, userId) {
  const conv = await Conversation.findOne({ _id: conversationId, businessId, userId });
  if (!conv) throw new Error('Conversación no encontrada');
  conv.isActive = false;
  await conv.save();
  return { deleted: true };
}
