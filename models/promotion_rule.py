from odoo import api, models, fields


class PromotionRule(models.Model):
 
    _name = 'promotion.rule'
    _inherit = ['mail.thread']
    _description = 'Promotion Rule'
    
    name = fields.Char('Name', required=True, tracking=1)
    type = fields.Selection([('buy_more_than_x_amount', 'Buy More Than X Amount'),
                             ('buy_more_than_x_amount_from_categories', 'Buy More Than X Amount From Specific Categories'),
                             ('buy_more_than_x_amount_from_products', 'Buy More Than X Amount From Specific Products'),
                             ('buy_more_than_x_qty', 'Buy More Than X Quantity'),
                             ('buy_more_than_x_qty_from_categories', 'Buy More Than X Quantity From Specific Categories'),
                             ('buy_more_than_x_qty_from_products', 'Buy More Than X Quantity From Specific Products'),
                             ('buy_combo_products', 'Buy Combo Products')], 'Type', required=True, tracking=2)
    price_rule = fields.Selection([('tax_exclusive', 'Price without Tax'),
                                   ('tax_inclusive', 'Price with Tax'),
                                   ('discount_inclusive', 'Price with Tax & Discount')], 'Price Calculation', tracking=3)
    min_amt = fields.Float('Minimum Amount', tracking=4)
    min_qty = fields.Float('Minimum Quantity', tracking=5)
    product_ids = fields.Many2many('product.product', 'promotion_rule_product_rel', 'rule_id', 'product_id', 'Products', domain=[('available_in_pos', '=', True)])
    category_ids = fields.Many2many('pos.category', 'promotion_rule_category_rel', 'rule_id', 'category_id', 'Categories')
    combo_line_ids = fields.One2many('promotion.combo.line', 'rule_id', 'Combo Products')
    note = fields.Text('Note')
    program_ids = fields.One2many('promotion.program', 'rule_id', 'Promotion Programs')


class PromotionComboLine(models.Model):

    _name = 'promotion.combo.line'
    _description = 'Promotion Combo Line'

    based_on = fields.Selection([('product', 'Product'),
                                 ('category', 'Category')], 'Type', required=True)
    product_ids = fields.Many2many('product.product', 'promotion_combo_line_product_rel', 'line_id', 'product_id', 'Products', domain=[('available_in_pos', '=', True)])
    category_ids = fields.Many2many('pos.category', 'promotion_combo_line_category_rel', 'line_id', 'category_id', 'Categories')
    qty = fields.Float('Qty', default=1, required=True)
    rule_id = fields.Many2one('promotion.rule', 'Rule', ondelete='cascade')

