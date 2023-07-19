from odoo import api, models, fields


class PromotionItem(models.Model):
 
    _name = 'promotion.item'
    _inherit = ['mail.thread']
    _description = 'Promotion Item'

    name = fields.Char('Name', required=True, tracking=1)
    type = fields.Selection([('fixed_discount', 'Fixed Discount'),
                             ('percent_discount', 'Percent Discount'),
                             ('free_product', 'Free Products')], 'Type', required=True, tracking=2)
    discount_rule = fields.Selection([('order', 'Whole Order'),
                                      ('category', 'Specific Categories'),
                                      ('product', 'Specific Products')], 'Discount Rule', tracking=3)
    price_rule = fields.Selection([('tax_exclusive', 'Price without Tax'),
                                   ('tax_inclusive', 'Price with Tax'),
                                   ('discount_inclusive', 'Price with Tax & Discount')], 'Price Calculation', tracking=4)
    discount = fields.Float('Discount', tracking=5)
    product_id = fields.Many2one('product.product', 'Product', domain=[('available_in_pos', '=', True), 
                                                                       ('detailed_type', '=', 'service')], tracking=6)
    product_ids = fields.Many2many('product.product', 'promotion_item_product_rel', 'item_id', 'product_id', 'Products', domain=[('available_in_pos', '=', True)])
    category_ids = fields.Many2many('pos.category', 'promotion_item_category_rel', 'item_id', 'category_id', 'Categories')
    item_rule = fields.Selection([('every_occurrence', 'Every Occurrence'),
                                  ('max_occurrence', 'Max Occurrence')], 'Item Rule', tracking=7)
    max_occurrence = fields.Float('Max Occurrence', default=1, tracking=8)
    max_discount = fields.Float('Max Discount', tracking=9)
    free_product_ids = fields.One2many('promotion.free.product', 'item_id', 'Free Products')
    note = fields.Text('Note')
    program_ids = fields.One2many('promotion.program', 'item_id', 'Promotion Programs')

    def get_discount_products(self):
        promotion_program_domain = self.env['pos.session']._loader_params_promotion_program()['search_params']['domain']
        products = self.env['promotion.program'].search(promotion_program_domain).item_id.product_id.filtered_domain([('available_in_pos', '!=', True)])
        return products


class PromotionFreeProduct(models.Model):

    _name = 'promotion.free.product'
    _description = 'Promotion Free Product'

    product_id = fields.Many2one('product.product', 'Product', domain=[('available_in_pos', '=', True)], required=True)
    qty = fields.Float('Quantity', required=True, default=1)
    item_id = fields.Many2one('promotion.item', 'Item', ondelete='cascade')

