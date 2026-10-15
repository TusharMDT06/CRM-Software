import { Schema } from 'mongoose';
import { RealtimeEntityType } from '@flowdesk/shared';
import { emitChange } from '../realtime/socket.js';

export function realtimePlugin(entity: RealtimeEntityType) {
  return function (schema: Schema) {
    // 1. Track isNew before document is saved
    schema.pre('save', function (this: any, next) {
      if (this.$locals) {
        this.$locals.wasNew = this.isNew;
      }
      next();
    });

    // 2. Post-save hook (covers doc.save() for both create and update)
    schema.post('save', function (doc: any) {
      try {
        const wasNew = Boolean(doc?.$locals?.wasNew);
        const action = wasNew ? 'created' : 'updated';
        emitChange({
          entity,
          action,
          id: doc._id?.toString(),
          orgId: doc.tenantId?.toString(),
          updatedAt: doc.updatedAt || new Date(),
          data: doc.toObject ? doc.toObject() : doc,
        });
      } catch (err) {
        // Realtime errors must never crash write transactions
      }
    });

    // 3. Post-findOneAndUpdate hook
    schema.post('findOneAndUpdate', function (doc: any) {
      try {
        if (doc) {
          emitChange({
            entity,
            action: 'updated',
            id: doc._id?.toString(),
            orgId: doc.tenantId?.toString(),
            updatedAt: doc.updatedAt || new Date(),
            data: doc.toObject ? doc.toObject() : doc,
          });
        }
      } catch (err) {}
    });

    // 4. Post-findOneAndDelete hook
    schema.post('findOneAndDelete', function (doc: any) {
      try {
        if (doc) {
          emitChange({
            entity,
            action: 'deleted',
            id: doc._id?.toString(),
            orgId: doc.tenantId?.toString(),
            updatedAt: new Date(),
          });
        }
      } catch (err) {}
    });

    // 5. Post-deleteOne hook
    schema.post('deleteOne', { document: true, query: false } as any, function (doc: any) {
      try {
        if (doc) {
          emitChange({
            entity,
            action: 'deleted',
            id: doc._id?.toString(),
            orgId: doc.tenantId?.toString(),
            updatedAt: new Date(),
          });
        }
      } catch (err) {}
    });

    // 6. Post-insertMany hook
    schema.post('insertMany', function (docs: any) {
      try {
        if (Array.isArray(docs)) {
          if (docs.length > 5) {
            emitChange({
              entity,
              action: 'bulk',
              orgId: docs[0]?.tenantId?.toString(),
              updatedAt: new Date(),
            });
          } else {
            docs.forEach((doc) => {
              emitChange({
                entity,
                action: 'created',
                id: doc._id?.toString(),
                orgId: doc.tenantId?.toString(),
                updatedAt: doc.updatedAt || new Date(),
                data: doc.toObject ? doc.toObject() : doc,
              });
            });
          }
        }
      } catch (err) {}
    });

    // 7. Post-updateMany & deleteMany bulk operations
    schema.post('updateMany', function () {
      try {
        emitChange({
          entity,
          action: 'bulk',
          updatedAt: new Date(),
        });
      } catch (err) {}
    });

    schema.post('deleteMany', function () {
      try {
        emitChange({
          entity,
          action: 'bulk',
          updatedAt: new Date(),
        });
      } catch (err) {}
    });
  };
}
