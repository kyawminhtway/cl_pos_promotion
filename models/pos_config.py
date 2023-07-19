from odoo import models


class PosConfig(models.Model):

    _inherit = 'pos.config'

    def get_limited_products_loading(self, fields):
        products = super().get_limited_products_loading(fields)
        discount_products = self.env['promotion.item'].get_discount_products()
        discount_products = self.env['product.product'].search_read([('id', 'in', discount_products.ids)], fields=fields)
        return products + discount_products

