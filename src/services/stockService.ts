import Item, { IItem } from '../models/Item';
import mongoose from 'mongoose';

/**
 * Servicio para manejar operaciones relacionadas con el stock de productos e insumos
 */
class StockService {
  /**
   * Actualiza el stock de un ítem solo si está inventariado
   * @param itemId ID del ítem a actualizar
   * @param quantity Cantidad a reducir (negativo) o aumentar (positivo) del stock
   * @returns El ítem actualizado o null si no se encuentra o no está inventariado
   */
  async updateStock(itemId: string, quantity: number): Promise<IItem | null> {
    try {
      // Primero verificamos si el ítem existe y está inventariado
      const item = await Item.findById(itemId);

      if (!item || item.isDeleted) {
        return null;
      }

      // Solo actualizamos el stock si el ítem está inventariado
      if (item.isInventoried) {
        // Si el stock es null, lo inicializamos en 0 antes de la operación
        const currentStock = item.stock === null ? 0 : item.stock;

        // Calculamos el nuevo stock
        const newStock = currentStock + quantity;

        // Validamos que no quede en negativo
        if (newStock < 0) {
          throw new Error(`Stock insuficiente para el ítem ${item.name}`);
        }

        // Actualizamos el stock
        item.stock = newStock;
        await item.save();
      }

      return item;
    } catch (error) {
      console.error('Error al actualizar stock:', error);
      throw error;
    }
  }

  /**
   * Actualiza el stock de múltiples ítems en una sola operación
   * @param items Array de objetos con ID del ítem y cantidad a actualizar
   * @returns Array con los ítems actualizados
   */
  async updateBulkStock(items: Array<{ itemId: string, quantity: number }>): Promise<Array<IItem | null>> {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const updatedItems: Array<IItem | null> = [];

      for (const { itemId, quantity } of items) {
        const updatedItem = await this.updateStock(itemId, quantity);
        updatedItems.push(updatedItem);
      }

      await session.commitTransaction();
      session.endSession();

      return updatedItems;
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      console.error('Error en actualización masiva de stock:', error);
      throw error;
    }
  }

  /**
   * Activa o desactiva el inventario para un ítem
   * @param itemId ID del ítem a modificar
   * @param isInventoried true para activar inventario, false para desactivarlo
   * @param initialStock Stock inicial al activar inventario (opcional)
   * @returns El ítem actualizado
   */
  async toggleInventory(itemId: string, isInventoried: boolean, initialStock?: number): Promise<IItem | null> {
    try {
      const item = await Item.findById(itemId);

      if (!item || item.isDeleted) {
        return null;
      }

      item.isInventoried = isInventoried;

      // Si estamos activando el inventario y se proporciona un stock inicial
      if (isInventoried && initialStock !== undefined) {
        item.stock = initialStock;
      }

      // Si estamos desactivando el inventario, podemos mantener el valor del stock por razones históricas
      // o establecerlo a null si se desea limpiar esa información

      await item.save();
      return item;
    } catch (error) {
      console.error('Error al cambiar estado de inventario:', error);
      throw error;
    }
  }
}

export default new StockService(); 