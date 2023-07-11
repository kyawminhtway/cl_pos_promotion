odoo.define('cl_promotion_program.models', function(require){

var { PosGlobalState, Order, Orderline } = require('point_of_sale.models');
var Registries = require('point_of_sale.Registries');

var PromotionProgramPosGlobalState = (PosGlobalState) => class extends PosGlobalState{
    async _processData(loadedData) {
        await super._processData(...arguments);
        this.cl_promotion = {
            programs: loadedData['promotion.program'],
            rules: loadedData['promotion.rule'],
            combo_lines: loadedData['promotion.combo.line'],
            items: loadedData['promotion.item'],
            free_products: loadedData['promotion.free.product'],
        };
    }
};

var PromotionProgramOrder = (Order) => class extends Order{
    constructor(obj, options) {
        super(...arguments);
    }
    init_from_JSON(json) {
        super.init_from_JSON(...arguments);
    }
    export_as_JSON(){
        var res = super.export_as_JSON(...arguments);
        return res;
    }
    export_for_printing(){
        var res = super.export_for_printing(...arguments);
        return res;
    }
    add_product(product, options){
        var res = super.add_product(...arguments);
        this.compute_cl_promotions();
        return res;
    }
    set_orderline_options(orderline, options) {
        super.set_orderline_options(...arguments);
    }
    compute_cl_promotions(){
        this.prepare_cl_promotions_utilities();
        var applicable_programs=[], occurrence=0;
        var cl_promotion = this.pos.cl_promotion;
        for(var rule_id of cl_promotion.rules.ids){
            var rule = cl_promotion.rules.by_id[rule_id];
            if(rule.type in ['buy_more_than_x_amount', 'buy_more_than_x_amount_from_categories', 'buy_more_than_x_amount_from_products']){
                occurrence = this.get_cl_promotion_x_occurrence('amount', rule, rule.min_amt);
            }else if(rule.type in ['buy_more_than_x_qty', 'buy_more_than_x_qty_from_categories', 'buy_more_than_x_qty_from_products']){
                occurrence = this.get_cl_promotion_x_occurrence('quantity', rule, rule.min_qty);
            }else if(rule.type in ['buy_combo_products']){
                occurrence = this.get_cl_promotion_combo_products_occurrence(rule);
            }
            var applicable = occurrence > 0;
            if(applicable){
                applicable_programs = [...rule.program_ids, ...applicable_programs];
            }
        }
        for(var item_id in cl_promotion.items.ids){
            var applicable = false;
            var item = cl_promotion.items.by_id[item_id];
            if(['fixed_discount', 'percent_discount'].includes(item.type) && item.discount_rule !== 'order'){
                this.check_discount_applicable(item);
            }
        }
    }
    prepare_cl_promotions_utilities(){
        var amount = {overall: {tax_exclusive: 0, tax_inclusive: 0, discount_inclusive: 0}, by_product: {}, by_category: {}};
        var quantity = {overall: 0, by_product: {}, by_category: {}};
        for(var orderline of this.orderlines){
            if(orderline.promotion_ids.length > 0){
                continue;
            }
            var product_id = orderline.product.id;
            var category_id = orderline.product.pos_categ_id && orderline.product.pos_categ_id[0] || false;
            
            // Grouped Amount & Quantity By Product, By Category & Overall
            var prices = orderline.get_all_prices();
            var tax_exclusive = prices.priceWithoutTax;
            var tax_inclusive = prices.priceWithTaxBeforeDiscount;
            var discount_inclusive = prices.priceWithTax;
            var qty = orderline.get_quantity();
            
            amount.overall.tax_exclusive += tax_exclusive;
            amount.overall.tax_inclusive += tax_inclusive;
            amount.overall.discount_inclusive += discount_inclusive;
            quantity.overall += qty;

            var grouped_by_product = this.get_grouped_value(amount.by_product, product_id);
            grouped_by_product.tax_exclusive += tax_exclusive;
            grouped_by_product.tax_inclusive += tax_inclusive;
            grouped_by_product.discount_inclusive += discount_inclusive;
            amount.by_product[product_id] = grouped_by_product;
            quantity.by_product[product_id] = (quantity.by_product[product_id] || 0) + qty;
            
            if(category_id !== false){
                var grouped_by_category= this.get_grouped_value(amount.by_category, category_id);
                grouped_by_category.tax_exclusive += tax_exclusive;
                grouped_by_category.tax_inclusive += tax_inclusive;
                grouped_by_category.discount_inclusive += discount_inclusive;
                amount.by_category[category_id] = grouped_by_category;
                quantity.by_category[category_id] = (quantity.by_category[category_id] || 0) + qty;
            } 
        }
        this.cl_promotion_utilities = {
            amount,
            quantity,
        };
    }
    // Helper Methods
    prepare_occurrence(value, min_value){
        return Math.floor(parseFloat(value) / parseFloat(min_value)) 
    }
    get_grouped_value(grouped_value, record_id){
        var prev_values = grouped_value[record_id];
        if(prev_values === undefined){
            prev_values = {tax_exclusive: 0, tax_inclusive: 0, discount_inclusive: 0};
        }else{
            prev_values = {
                tax_exclusive: prev_values.tax_exclusive || 0, 
                tax_inclusive: prev_values.tax_inclusive || 0, 
                discount_inclusive: prev_values.discount_inclusive || 0
            };
        }
        return prev_values;
    }
    check_discount_applicable(item){
        var amount = 0;
        var utilities = this.cl_promotion_utilities;
        var record_ids = eval(`item.${item.discount_rule}_ids`);
        var products = utilities.amount.by_product;
        for(var product in products){
            product = this.pos.db.get_product_by_id(parseInt(product));
            var product_id = product.id;
            var category_id = product.pos_categ_id ? product.pos_categ_id[0] : false;
            if(record_ids.includes(eval(`${item.discount_rule}_id`))){
                amount += utilities.amount[eval(`by_${item.discount_rule}`)][eval(`${item.discount_rule}_id`)];
            }
        }
        return amount;
    }
    get_cl_promotion_x_occurrence(type, rule, min_value){
        var utilities = this.cl_promotion_utilities;
        var value=0, category_ids=[], product_ids=[];
        if(['buy_more_than_x_amount_from_categories', 'buy_more_than_x_qty_from_categories'].includes(rule.type)){
            category_ids = rule.category_ids;
        }else if(['buy_more_than_x_amount_from_products', 'buy_more_than_x_qty_from_products'].includes(rule.type)){
            product_ids = rule.product_ids;
        }else{
            value = type === 'amount' ? utilities.amount.overall[rule.price_rule] : utilities.quantity.overall;
            return this.prepare_occurrence(value, min_value);
        }
        var products = type === 'amount' ? utilities.amount.by_product : utilities.quantity.by_product;
        for(var product in products){
            product = this.pos.db.get_product_by_id(parseInt(product));
            var product_id = product.id;
            var category_id = product.pos_categ_id ? product.pos_categ_id[0] : false;
            if(category_ids.length > 0 && category_ids.includes(category_id)){
                value += type === 'amount' ? utilities.amount.by_category[category_id][rule.price_rule] : utilities.quantity.by_category[category_id];
            }else if(product_ids.length > 0 && product_ids.includes(product_id)){
                value += type === 'amount' ? utilities.amount.by_product[category_id][rule.price_rule] : utilities.quantity.by_product[category_id];
            }
        }
        return this.prepare_occurrence(value, min_value);
    }
    get_cl_promotion_combo_products_occurrence(rule){
        var occurrence = 0;
        var utilities = this.cl_promotion_utilities;
        var cl_promotion = this.pos.cl_promotion;
        for(var combo_line_id of rule.combo_line_ids){
            var qty = 0;
            var combo_line = cl_promotion.combo_lines.by_id[combo_line_id];
            var record_ids = combo_line.based_on === 'product' ? combo_line.product_ids : combo_line.category_ids;
            for(var record_id of record_ids){
                qty += utilities.quantity[`by_${combo_line.based_on}`][record_id];
            }
            var line_occurrence = this.prepare_occurrence(qty, combo_line.qty);
            if(line_occurrence <= 0){
                occurrence = 0;
                break;
            }else if(occurrence === 0 || line_occurrence < occurrence){
                occurrence = line_occurrence;
            }
        }
        return occurrence;
    }
};

var PromotionProgramOrderline = (Orderline) => class extends Orderline{
    constructor(obj, options){
        super(...arguments);
        this.promotion_ids = options.promotion_ids || []; 
    }
    init_from_JSON(json){
        super.init_from_JSON(...arguments);
        this.promotion_ids = json.promotion_ids || [];
    }
    export_as_JSON(){
        var res = super.export_as_JSON(...arguments);
        return {
            ...res,
            promotion_ids: this.promotion_ids,
        };
    };
    export_for_printing(){
        var res = super.export_for_printing(...arguments);
        return {
            ...res,
            promotion_ids: this.promotion_ids,
        };
    };
    can_be_merged_with(orderline){
        var res = super.can_be_merged_with(...arguments);
        return res;
    }
    set_quantity(quantity, keep_price){
        var res = super.set_quantity(...arguments);
        this.order.compute_cl_promotions();
        return res;
    }
    set_unit_price(price){
        super.set_unit_price(...arguments);
        this.order.compute_cl_promotions();
    }
    set_discount(discount){
        super.set_discount(...arguments);
        this.order.compute_cl_promotions();
    }
    set_lst_price(price){
        super.set_lst_price(...arguments);
        this.order.compute_cl_promotions();
    }
};

Registries.Model.extend(PosGlobalState, PromotionProgramPosGlobalState);
Registries.Model.extend(Order, PromotionProgramOrder);
Registries.Model.extend(Orderline, PromotionProgramOrderline);

});