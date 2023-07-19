odoo.define('cl_pos_promotion.SetApplyPromotionButton', function(require) {

'use strict';

var PosComponent = require('point_of_sale.PosComponent');
var ProductScreen = require('point_of_sale.ProductScreen');
var { useListener } = require("@web/core/utils/hooks");
var Registries = require('point_of_sale.Registries');

class SetApplyPromotionButton extends PosComponent {
    setup() {
        super.setup();
        useListener('click', this.onClick);
    }
    get currentOrder() {
        return this.env.pos.get_order();
    }
    async onClick() {
        var items = [];
        var programs_by_id = this.env.pos.cl_promotion.programs.by_id;
        var applicable_programs = this.currentOrder.cl_applicable_programs;
        for(var applicable_program in applicable_programs){
            items.push(programs_by_id[applicable_program]);
        }
        if(items.length > 0){
            const { confirmed, payload } = await this.showPopup('SelectPromotionProgramsPopup', { items });
            if(!confirmed || payload.length <= 0){return}
            this.currentOrder.apply_cl_programs(payload);
        }
    }
}

SetApplyPromotionButton.template = 'SetApplyPromotionButton';
ProductScreen.addControlButton({
    component: SetApplyPromotionButton,
    condition: function() {
        return true;
    },
});
Registries.Component.add(SetApplyPromotionButton);

return SetApplyPromotionButton;
});
