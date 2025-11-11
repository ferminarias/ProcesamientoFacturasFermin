import { FacturaExtractor } from '@/lib/services/extractors/factura.extractor';

describe('FacturaExtractor', () => {
  let extractor: FacturaExtractor;

  beforeEach(() => {
    extractor = new FacturaExtractor();
  });

  describe('extractFromImage', () => {
    it('should extract basic factura data', async () => {
      // Mock OpenAI response
      const mockResponse = {
        tipo_factura: 'A',
        numero: '0001-00012345',
        fecha_emision: '2024-01-15',
        emisor: {
          razon_social: 'Test SA',
          cuit: '30-12345678-9',
          condicion_iva: 'Responsable Inscripto',
        },
        receptor: {
          razon_social: 'Cliente SA',
          cuit: '30-98765432-1',
          condicion_iva: 'Responsable Inscripto',
        },
        items: [
          {
            descripcion: 'Producto Test',
            cantidad: 1,
            precio_unitario: 100,
            subtotal: 100,
          },
        ],
        subtotal: 100,
        iva: 21,
        total: 121,
      };

      // Mock the OpenAI call
      jest.spyOn(extractor as any, 'callVisionAPI').mockResolvedValue(mockResponse);

      const result = await extractor.extractFromImage('test-image-url');

      expect(result).toEqual(mockResponse);
      expect(result.tipo_factura).toBe('A');
      expect(result.numero).toBe('0001-00012345');
      expect(result.total).toBe(121);
    });

    it('should handle extraction errors gracefully', async () => {
      jest.spyOn(extractor as any, 'callVisionAPI').mockRejectedValue(
        new Error('API Error')
      );

      await expect(extractor.extractFromImage('test-image-url')).rejects.toThrow(
        'API Error'
      );
    });
  });

  describe('validateTotals', () => {
    it('should validate correct totals', () => {
      const data = {
        subtotal: 100,
        iva: 21,
        total: 121,
      };

      const isValid = (extractor as any).validateTotals(data);
      expect(isValid).toBe(true);
    });

    it('should detect incorrect totals', () => {
      const data = {
        subtotal: 100,
        iva: 21,
        total: 120, // Wrong total
      };

      const isValid = (extractor as any).validateTotals(data);
      expect(isValid).toBe(false);
    });
  });
});
