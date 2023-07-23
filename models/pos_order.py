from odoo import api, models, fields


class PosOrderLine(models.Model):

    _inherit = 'pos.order.line'

    promotion_ids = fields.Many2many('promotion.program', 'pos_order_line_promotion_rel', 'line_id', 'promotion_id', 'Promotion Programs')
    promotion_json = fields.Text('Promotion JSON')

    def _order_line_fields(self, line, session_id=None):
        res = super()._order_line_fields(line, session_id)
        promotions = line[2].get('cl_promotions', [])
        res[2]['promotion_ids'] = [(6, 0, [promotion['id'] for promotion in promotions])]
        res[2]['promotion_json'] = promotions
        return res
    
    def _export_for_ui(self, orderline):
        res = super()._export_for_ui(orderline)
        res['cl_promotions'] = [{'id': promotion.id, 'description': promotion.name} for promotion in orderline.promotion_ids]
        return res

