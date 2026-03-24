import { Router } from 'express';
import GalleryImage from './models/GalleryImage.js';
import websocketService from './services/websocketService.js';

const router = Router();

// Add gallery image
router.post("/add-image", async (req, res) => {
    try {
        const imageData = req.body;
        const business = req.query.business;
        
        const galleryImage = new GalleryImage({
            businessId: business,
            id: imageData.id,
            url: imageData.url,
            name: imageData.name,
            uploadedAt: imageData.uploadedAt || new Date(),
            size: imageData.size,
            dimensionsWidth: imageData.dimensionsWidth,
            dimensionsHeight: imageData.dimensionsHeight,
            type: imageData.type,
            usedIn: imageData.usedIn || [],
            storagePath: imageData.storagePath
        });

        const savedImage = await galleryImage.save();
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'gallery-image-added', savedImage);
        
        res.status(200).json({ 
            success: true, 
            image: savedImage 
        });
    } catch (error) {
        console.error('Error adding gallery image:', error);
        res.status(500).json({ error: "Error al agregar imagen" });
    }
});

// Update gallery image
router.put("/update-image/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const imageData = req.body;
        const business = req.query.business;
        
        const updatedImage = await GalleryImage.findOneAndUpdate(
            { id: id, businessId: business },
            { 
                id: id,
                ...imageData,
                updatedAt: new Date()
            },
            { new: true }
        );
        
        if (!updatedImage) {
            return res.status(404).json({ error: "Imagen no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'gallery-image-updated', updatedImage);
        
        res.status(200).json({ 
            success: true, 
            image: updatedImage 
        });
    } catch (error) {
        console.error('Error updating gallery image:', error);
        res.status(500).json({ error: "Error al actualizar imagen" });
    }
});

// Delete gallery image
router.delete("/delete-image/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;

        const deletedImage = await GalleryImage.findOneAndDelete({ 
            id: id, 
            businessId: business 
        });
        
        if (!deletedImage) {
            return res.status(404).json({ error: "Imagen no encontrada" });
        }
        
        // Emit real-time update
        websocketService.emitToBusiness(business, 'gallery-image-deleted', { id });
        
        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Error deleting gallery image:', error);
        res.status(500).json({ error: "Error al eliminar imagen" });
    }
});

// Get gallery image by id
router.get("/get-image/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const business = req.query.business;
        
        const image = await GalleryImage.findOne({ 
            id: id, 
            businessId: business 
        });
        
        if (!image) {
            return res.status(404).json({ error: "Imagen no encontrada" });
        }
        
        res.status(200).json({ image });
    } catch (error) {
        console.error('Error getting gallery image:', error);
        res.status(500).json({ error: "Error al obtener imagen" });
    }
});

// Get all gallery images
router.get("/get-all-images", async (req, res) => {
    try {
        const business = req.query.business;
        const type = req.query.type;
        
        const filter = { 
            businessId: business 
        };
        
        if (type) {
            filter.type = type;
        }
        
        const images = await GalleryImage.find(filter).sort({ uploadedAt: -1 });
        
        res.status(200).json({ images });
    } catch (error) {
        console.error('Error getting all gallery images:', error);
        res.status(500).json({ error: "Error al obtener imágenes" });
    }
});

// Get images used by a product
router.get("/get-images-by-product/:productId", async (req, res) => {
    try {
        const productId = req.params.productId;
        const business = req.query.business;
        
        const images = await GalleryImage.find({ 
            businessId: business,
            usedIn: productId 
        }).sort({ uploadedAt: -1 });
        
        res.status(200).json({ images });
    } catch (error) {
        console.error('Error getting images by product:', error);
        res.status(500).json({ error: "Error al obtener imágenes del producto" });
    }
});

// Update image usage (add/remove product from usedIn)
router.put("/update-image-usage/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const { productId, action } = req.body; 
        const business = req.query.business;
        const image = await GalleryImage.findOne({ id: id, businessId: business });
        
        if (!image) {
            return res.status(404).json({ error: "Imagen no encontrada" });
        }
        
        if (action === 'add') {

            if (!image.usedIn.includes(productId)) {

                image.usedIn.push(productId);
            }
        } else if (action === 'remove') {

            image.usedIn = image.usedIn.filter(id => id !== productId);
        }
        
        image.updatedAt = new Date();
        const updatedImage = await image.save();

        // Emit real-time update
        websocketService.emitToBusiness(business, 'gallery-image-usage-updated', updatedImage);
        
        res.status(200).json({ 
            success: true, 
            image: updatedImage 
        });
    } catch (error) {
        console.error('Error updating image usage:', error);
        res.status(500).json({ error: "Error al actualizar uso de imagen" });
    }
});

export default router;