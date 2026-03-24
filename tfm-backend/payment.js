import { Router } from 'express';
import axios from 'axios';

const router = Router();

// GET /validate-payment - Validar pago móvil
router.get("/validate-payment", async (req, res) => {
    const {
        bank,
        phonenumberclient,
        date,
        reference,
        amount,
        clientId
    } = req.query;

    try {
        // Datos quemados para pruebas (basados en el ejemplo de Instapago)
        const testParams = {
            receiptbank: "0134", // Código del banco receptor
            bank: "0134", // Código del banco emisor
            keyId: "890AB86E-5938-4CEB-BC37-CA8C1CF78294", // Key ID de prueba
            publickeyid: "e46dc9c8ce04bccfd742322b3ccc9049", // Public Key ID de prueba
            phonenumberclient: "00584242322481", // Teléfono de prueba
            date:  "2023-10-17", // Fecha de prueba
            reference:  "028251997974", // Referencia de prueba
            amount:  "1.00", // Monto de prueba
            clientId: "V20839247" // Client ID de prueba
        };

        console.log("Validando pago con parámetros:", testParams);

        // Llamada a la API de Instapago
        const { data } = await axios.get("https://merchant.instapago.com/services/api/v2/Payments/p2p/ValidatePayment", {
            params: testParams
        });


        console.log("Respuesta de Instapago:", data);

        // Procesar respuesta
        if (data.success) {
            return res.status(200).json({
                success: true,
                message: data.message,
                code: data.code
            });
        } else {
            return res.status(Number(data.code)).json({
                success: false,
                message: data.message,
                code: data.code
            });
        }

    } catch (err) {
        console.error("Error validando pago móvil:", err);
        
        // Si es un error de axios, extraer información del error
        if (err.response) {
            return res.status(Number(err.response.status)).json({
                success: false,
                message: err.response.data.message,
                error: err.response.data
            });
        }
        
        return res.status(500).json({
            success: false,
            message: err.message,
            error: err.message
        });
    }
}); 

// GET /validate-payment-demo - Validar pago móvil en la demo
router.get("/validate-payment-demo", async (req, res) => {

        const data = {
            success: true,
            message: "Pago validado correctamente",
            code: 200
        };

        // Procesar respuesta
        if (data.success) {
            return res.status(200).json({
                success: true,
                message: data.message,
                code: data.code
            });
        } else {
            return res.status(Number(data.code)).json({
                success: false,
                message: data.message,
                code: data.code
            });
        }
}); 

export default router;
