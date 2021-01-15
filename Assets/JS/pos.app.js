/**
 * This file is part of POS plugin for FacturaScripts
 * Copyright (C) 2018-2021 Juan José Prieto Dzul <juanjoseprieto88@gmail.com>
 */
import * as POS from './POS/ShoppingCartTools.js';
import * as Checkout from './POS/Checkout.js';
import ShoppingCart from "./POS/ShoppingCart.js";

// Template variables
const EtaTemplate = Eta;
const cartTemplate = EtaTemplate.compile(document.getElementById('cartTemplateSource').innerHTML);
const customerTemplate = EtaTemplate.compile(document.getElementById('customerTemplateSource').innerHTML);
const productTemplate = EtaTemplate.compile(document.getElementById('productTemplateSource').innerHTML);
const templateConfig = EtaTemplate.config;

const barcodeInputBox = document.getElementById("productBarcodeInput");
const cartContainer = document.getElementById('cartContainer');
const customerSearchResult = document.getElementById('customerSearchResult');
const productSearchResult = document.getElementById('productSearchResult');
const salesForm = document.getElementById("salesDocumentForm");
const stepper = new Stepper(document.querySelector('.bs-stepper'));

var Cart = new ShoppingCart();
var payments = {};

function onCartDelete(e) {
    let index = e.getAttribute('data-index');

    Cart.remove(index);
    updateCart();
}

function onCartEdit(e) {
    let field = e.getAttribute('data-field');
    let index = e.getAttribute('data-index');

    Cart.edit(index, field, e.value);
    updateCart();
}

function searchCustomer(query) {
    function updateSearchResult(response) {
        customerSearchResult.innerHTML = customerTemplate({items: response}, templateConfig);
    }

    POS.search(updateSearchResult, query, 'customer');
}

function searchProduct(query) {
    function updateSearchResult(response) {
        productSearchResult.innerHTML = productTemplate({items: response}, templateConfig);
    }

    POS.search(updateSearchResult, query, 'product');
}

function searchProductBarcode(query) {
    function searchBarcode(response) {
        if (response.length > 0) {
            setProduct(response[0].code, response[0].description);
        }
        barcodeInputBox.value = '';
    }

    POS.searchBarcode(searchBarcode(), query);
}

function setProduct(code, description) {
    Cart.add(code, description);
    updateCart();
}

function setCustomer(code, description) {
    document.getElementById('codcliente').value = code;
    document.getElementById('customerSearchBox').value = description;
    Cart.setCustomer(code);

    $('.modal').modal('hide');
}

function updateCart() {
    console.info('Cart Before', Cart);
    function updateCartData(data) {
        Cart = new ShoppingCart(data);
        console.log(Cart);
        updateCartView(data);
    }

    POS.recalculate(updateCartData, Cart.lines, salesForm);
}

function updateCartView(data) {
    const elements = salesForm.elements;

    for(let i = 0; i < elements.length; i++) {
        const element = elements[i];

        if (element.name ) {
            const value = data.doc[element.name];
            switch (element.type) {
                case "checkbox" :
                    element.checked = value;
                    break;
                default :
                    element.value = value;
            }
        }
    }

    salesForm.cartTotalDisplay.value = data.doc.total;
    salesForm.cartTaxesDisplay.value = data.doc.totaliva;
    salesForm.cartNetoDisplay.value = data.doc.netosindto;

    document.getElementById('cartNeto').value = data.doc.netosindto;
    document.getElementById('cartTaxes').value = data.doc.totaliva;
    document.getElementById('cartTotal').value = data.doc.total;
    document.getElementById('checkoutTotal').textContent = data.doc.total;

    cartContainer.innerHTML = cartTemplate(data, templateConfig);
    $('.modal').modal('hide');
}

function recalculatePaymentAmount() {
    const checkoutButton = document.getElementById('checkoutButton');
    let paymentAmount = document.getElementById('paymentAmount');
    let paymentChange = document.getElementById('paymentChange');
    let paymentMethod = document.getElementById("paymentMethod");
    let total = parseFloat(document.getElementById('total').value);

    let paymentReturn = (paymentAmount.value - total) || 0;

    if (paymentMethod.value !== CASH_PAYMENT_METHOD) {
        if (paymentReturn > 0) {
            paymentReturn = 0;
            paymentAmount.value = POS.formatNumber(total);
        }
    }
    paymentChange.value = POS.formatNumber(paymentReturn);
    document.getElementById('paymentReturn').textContent = paymentReturn;
    document.getElementById('paymentOnHand').textContent = paymentAmount.value;
    if (paymentReturn >= 0) {
        checkoutButton.removeAttribute('disabled');
    } else {
        checkoutButton.setAttribute('disabled', 'disabled');
    }
}

function onCheckoutConfirm() {
    let paymentData = {};
    paymentData.amount = document.getElementById('paymentAmount').value;
    paymentData.change = document.getElementById('paymentChange').value;
    paymentData.method = document.getElementById("paymentMethod").value;

    document.getElementById("action").value = 'save-document';
    document.getElementById("lines").value = JSON.stringify(Cart.lines);
    document.getElementById("payments").value = JSON.stringify(paymentData);
    document.getElementById("codpago").value = JSON.stringify(paymentData.method);
    salesForm.submit();
}

function onCheckoutModalShow() {
    /*let modalTitle = document.getElementById('dueAmount');
    modalTitle.textContent = document.getElementById('total').value;*/
}

function onPauseOperation() {
    if (false === POS.pauseDocument(Cart.lines, salesForm)) {
        $('#checkoutModal').modal('hide');
    }
}

function resumePausedDocument(code) {
    function resumeDocument(response) {
        setCustomer(response.doc.codcliente, response.doc.nombrecliente);
        Cart = new ShoppingCart(response);
        updateCartView(response);
    }

    POS.resumeDocument(resumeDocument, code);
}

$(document).ready(function () {
    onScan.attachTo(barcodeInputBox, {
        onScan: function(code) { searchProductBarcode(code); }
    });

    $('[data-toggle="offcanvas"]').on('click', function () {
        $('.offcanvas-collapse').toggleClass('open');
    });
    $('#checkoutButton').click(function () {
        onCheckoutConfirm();
    });
    $('#pauseButton').click(function () {
        onPauseOperation();
    });
    $('#paymentAmount').keyup(function () {
        recalculatePaymentAmount();
    });
    $('#paymentMethod').change(function () {
        recalculatePaymentAmount();
    });
    $('#checkoutModal').on('shown.bs.modal', function () {
        onCheckoutModalShow();
    });
    $('#saveCashupButton').on('click', function () {
        document.cashupForm.submit();
    });

    // Ajax Search Events
    $('#customerSearchBox').focus(function () {
        $('#customerSearchModal').modal('show');
    });
    $('#customerSearchModal').on('shown.bs.modal', function () {
        $('#customerSerachInput').focus();
    });
    $('#customerSerachInput').keyup(function () {
        searchCustomer($(this).val());
    });
    $('#customerSearchResult').on('click', '.item-add-button', function () {
        let code = $(this).data('code');
        let description = $(this).data('description');

        setCustomer(code, description);
    });

    $('#productSearchBox').focus(function () {
        $('#productSearchModal').modal('show');
    });
    $('#productSearchModal').on('shown.bs.modal', function () {
        $('#productSerachInput').focus();
    });
    $('#productSerachInput').keyup(function () {
        searchProduct($(this).val());
    });
    $('#productSearchResult').on('click', '.item-add-button', function () {
        let code = $(this).data('code');
        let description = $(this).data('description');

        setProduct(code, description);
    });

    $('#pausedOperations').on('click', '.resume-button', function () {
        let code = $(this).data('code');

        resumePausedDocument(code);
    });
});

cartContainer.addEventListener('focusout', function(e) {
    if(e.target.classList.contains('cart-item')) {
        onCartEdit(e.target);
    }
});

cartContainer.addEventListener('click', function(e) {
    if(e.target.classList.contains('cart-item-remove')) {
        onCartDelete(e.target);
    }
}, true);

document.querySelectorAll('.btn-next').forEach(item => {
    item.addEventListener('click', event => {
        stepper.next();
    });
});

document.querySelectorAll('.btn-previus').forEach(item => {
    item.addEventListener('click', event => {
        stepper.previous();
    });
});