# Skill: Stage 4 – Order → Payment → Shipping → WhatsApp Workflow

This document defines the **end‑to‑end workflow** of an order in the Ragil Aluminium system: from cart and order creation, through payment confirmation, into shipping, and finally customer notifications via WhatsApp.  
All agents must treat this workflow as a **process contract**: do not design flows that skip steps or mix responsibilities between modules and actors.

---

## 1. Scope of This Workflow

This workflow connects:

- **Actors** (Stage 2):
  - Customer,
  - Store Admin,
  - System/Worker.
- **Modules** (Stage 3):
  - Public UI,
  - Catalog,
  - Order,
  - Payment,
  - Shipping,
  - WhatsApp,
  - Admin UI.

It focuses on a **single order’s lifecycle** from the moment the customer uses the website until the order is completed or enters an issue/return state.

---

## 2. High‑Level Lifecycle States

At a high level, every order passes through these key states:

1. **Cart / Pre‑Order** – Customer configures products and variants, but no order exists yet.  
2. **Order Created (pending_payment)** – Order is created in the system, awaiting payment.  
3. **Payment Confirmed (processing / awaiting_fulfillment)** – Payment is verified and order is ready for warehouse/production.  
4. **Fulfillment (processing → packing → ready_to_ship)** – Physical work happens: production, picking, packing.  
5. **Shipping (shipped → in_transit → delivered)** – Carrier (JNT Cargo) moves the package.  
6. **Completion (completed)** – Order successfully finished.  
7. **Issue / Return (issue / return_in_process)** – Order has a problem or enters return flow.

Each step has **module responsibilities** and **WhatsApp notification points**.

---

## 3. Step 1 – Cart & Order Creation (Customer → Order Module)

### 3.1 Customer Cart Actions

Actor: **Customer**  
Modules: **Public UI**, **Catalog**, **Order**

Flow:

1. Customer browses catalog:
   - Public UI calls Catalog Module to display products, variants, taxonomy, and prices.
2. Customer adds items to cart:
   - Public UI calls Order Module to:
     - create or update a `cart`,
     - attach `cart_items` that reference `product_variant_id` + quantity.
3. Customer fills checkout form:
   - name,
   - shipping address,
   - WhatsApp phone number,
   - any additional notes.

At this stage:

- There is **no order yet**; only a cart and customer input.
- Stock is not reserved permanently, but the system may check availability.

### 3.2 Order Creation

Actor: **Customer** (via Public UI) + **System/Worker**  
Modules: **Order**, **Catalog**, **Shipping**, **Payment**, **WhatsApp**

When the customer clicks “Place Order” / “Checkout”:

0. Order Module assigns a session-scoped UUID idempotency key. The unique
   `orders.checkout_idempotency_key` guarantees double-click, retry, or parallel
   submission returns the same order and does not decrement stock twice.
1. Public UI instructs Order Module to create an `order` from the `cart`:
   - Snapshot customer data (name, address, WhatsApp number).
   - Snapshot items:
     - `product_id` / `product_variant_id`,
     - product name & attributes at order time,
     - unit price from Catalog Module,
     - quantity.
   - Compute order totals (products + estimated shipping).

2. Order Module sets initial states:
   - `order_status = pending_payment`
   - `payment_status = pending`
   - `shipping_status = pending_pickup`.

3. Shipping Module:
   - Receives address details.
   - Computes estimated shipping cost (e.g., via JNT Cargo or internal rules).
   - Stores shipping cost and initial shipping record (`shipment` draft).

4. Payment Module:
   - Creates a `payment` record linked to the order, with:
     - status `pending`,
     - expected amount,
     - payment method (e.g., bank transfer).

5. WhatsApp Module:
   - Receives an event “order_created”.
   - Sends a WhatsApp message to the customer:
     - order summary (order ID, items, total, shipping estimate),
     - payment instructions (bank details, amount),
     - explanation that the order will move forward once payment is confirmed.

Result:  
An order exists in state **pending_payment**, and the customer has all info needed to pay.

### 3.3 Cancellation and Inventory Compensation

Cancellation must run through Order Module, lock the order, aggregate item
quantities per variant, restore stock, write an audit event, and only then set
`order_status=cancelled`. A retry or parallel cancellation sees the locked
terminal state and must not restore stock a second time.

---

## 4. Step 2 – Payment & Confirmation (Customer → Store Admin → Payment/Order Modules)

### 4.1 Customer Sends Payment & Proof

Actor: **Customer**  
Modules: **WhatsApp**, optionally **Public UI**

Flow:

1. Customer performs a bank transfer to the provided account.
2. Customer sends payment proof:
   - usually via WhatsApp (photo of receipt or screenshot),
   - optionally via a web form that still ends up linking to Payment Module.

WhatsApp Module:

- Records the inbound message in `whatsapp_messages` with direction `inbound`.
- Associates the message with the `order_id` (preferably via link or by manual matching by Store Admin).

Payment is still **unverified** at this point.

### 4.2 Store Admin Verifies Payment

Actor: **Store Admin**  
Modules: **Admin UI**, **Payment**, **Order**, **WhatsApp**

Flow:

1. Store Admin opens Admin UI:
   - views orders with `payment_status = pending` and `order_status = pending_payment`.
   - checks linked WhatsApp messages or payment proofs.

2. If payment proof is valid:
   - Admin records a payment amount greater than zero.
   - Payment Module locks the order/payment rows and sums all `completed` payments.
   - `payment_status` changes from `pending` to `paid` only when settlement covers `orders.total_amount`; partial settlement remains `pending`.
   - Admin may add notes (who verified, time, channel).

3. Order Module reacts:
   - On payment confirmation:
     - `order_status` changes from `pending_payment` to `processing` or `awaiting_fulfillment`.
   - This indicates the order is ready for warehouse/production.

4. WhatsApp Module:
   - Receives event “payment_confirmed”.
   - Sends a WhatsApp message:
     - confirming payment,
     - stating that the order is now being processed / will be scheduled for production and packing.

Result:  
The order is now **paid** and ready for fulfillment. Warehouse/production can start work.
A later `failed` or `refunded` payment is reconciled to `orders.payment_status`
without silently keeping the order marked paid.

---

## 5. Step 3 – Fulfillment (Store Admin → Warehouse/Production → Order/Shipping Modules)

### 5.1 Internal Processing & Production

Actors: **Store Admin (warehouse/production)**  
Modules: **Admin UI**, **Order**, **Catalog**, **Shipping**

Flow:

1. Warehouse/production staff sees orders with:
   - `order_status = processing / awaiting_fulfillment`.
2. They:
   - check item details (dimensions, models, special notes),
   - plan production or picking.

As production/picking progresses, Order Module statuses may be updated:

- `order_status = processing` – items being produced or prepared.
- `order_status = packing` – items being packed into parcels.
- `order_status = ready_to_ship` – parcels are labeled and ready for carrier pickup.

The Shipping Module:

- Prepares shipment data:
  - address,
  - parcel counts,
  - weight and dimensions,
  - shipping cost confirmation.

### 5.2 Links to Shipping Preparation

Shipping Module:

- May generate internal labels or prepare data for JNT Cargo API.
- Ensures that, by the time `order_status = ready_to_ship`, all shipping data is correct:
  - address,
  - contact phone,
  - shipping cost stored in `shipments`.

Result:  
Order is physically ready, and shipping data is prepared.

---

## 6. Step 4 – Shipping (Store Admin/System → Carrier → Shipping/Order/WhatsApp Modules)

### 6.1 Creating Shipment with Carrier

Actors: **Store Admin**, **System/Worker**, **Carrier (JNT Cargo)**  
Modules: **Shipping**, **Order**, **WhatsApp**

Flow:

1. Store Admin or Worker calls the Shipping Module to create a shipment:
   - shipping data is sent to JNT Cargo (via API or manual system),
   - JNT Cargo returns a waybill/tracking number.

2. Shipping Module:
   - stores the waybill number and sets `shipping_status` to initial outbound state (`awaiting_pickup` or `shipped` depending on integration).
   - associates the shipment record with the order.

3. Order Module:
   - updates `order_status` to `shipped` when the parcel is handed to the carrier or pickup confirmed.

4. WhatsApp Module:
   - receives event “order_shipped”.
   - sends WhatsApp message:
     - telling the customer the order has been shipped,
     - including carrier name, waybill/tracking number,
     - possibly a link to tracking page.

### 6.2 In‑Transit Updates

Actors: **System/Worker**, **Carrier**  
Modules: **Shipping**, **Order**, **WhatsApp**

Flow:

1. Worker periodically checks carrier status:
   - calls JNT Cargo tracking APIs or receives webhooks.
   - reads status: in_process, sorted, in_transit, out_for_delivery, delivered, etc.

2. Shipping Module:
   - updates `shipping_status` according to carrier responses.
   - logs each change in `shipping_status_logs`.

3. Order Module:
   - may reflect major changes:
     - still `shipped` while in transit,
     - becomes `delivered` when carrier status indicates delivery.

4. WhatsApp Module:
   - for significant milestones (optional but recommended):
     - sends message when parcel is out for delivery.
     - sends message when parcel is marked as delivered.

Result:  
Customer stays informed throughout shipping, and system records the full shipping history.

---

## 7. Step 5 – Delivery & Completion (Customer → Store Admin → Order/WhatsApp Modules)

### 7.1 Delivery Confirmation

Actors: **Customer**, **Carrier**, **System/Worker**  
Modules: **Shipping**, **Order**, **WhatsApp**, optionally **Public UI**

Flow:

1. Carrier marks the shipment as delivered.
2. Shipping Module:
   - sets `shipping_status = delivered`.
3. Order Module:
   - updates `order_status` to `delivered` (pending final confirmation).

4. WhatsApp Module:
   - sends an automated message:
     - informing the customer that the carrier reports delivery,
     - asking the customer to confirm receipt or report issues.

Customer can:

- Confirm that everything is OK.
- Report problems (damage, missing items, wrong spec).

### 7.2 Final Completion

Actors: **Customer**, **Store Admin**  
Modules: **Order**, **WhatsApp**, **Admin UI**

Flow:

1. Customer confirms via WhatsApp or public UI:
   - “Yes, I received the order and it’s OK.”
2. Store Admin:
   - optionally reviews any notes or feedback.
   - sets `order_status = completed`.

3. WhatsApp Module:
   - may send a final “thank you” message or feedback request.

Result:  
Order lifecycle ends in **completed** state with all status logs and messages recorded.

---

## 8. Step 6 – Issues & Returns (Customer → Store Admin → Order/Payment/Shipping/WhatsApp)

### 8.1 Reporting an Issue

Actors: **Customer**, **Store Admin**  
Modules: **WhatsApp**, **Order**, **Shipping**, **Payment**

Flow:

1. Customer reports:
   - damaged item,
   - missing items,
   - wrong specification,
   - other complaints.
   Typically via WhatsApp or call.

2. Store Admin:
   - logs the issue linked to the order.
   - sets `order_status = issue` or `return_in_process`.

3. WhatsApp Module:
   - confirms receipt of complaint,
   - explains next steps (e.g., replacement or partial refund).

### 8.2 Handling Returns / Resolution

Actors: **Store Admin**, **System/Worker**  
Modules: **Order**, **Payment**, **Shipping**, **WhatsApp**

Possible actions:

- Arrange a return shipment:
  - Shipping Module creates a return shipment record.
- Process refunds or partial refunds:
  - Payment Module updates `payment_status` (e.g., `refunded`).
- Replace items:
  - Order Module may create additional line items or new orders for replacement.

Each significant step should:

- Update order and payment states.
- Trigger WhatsApp messages to keep the customer informed.

Order eventually transitions to:

- `completed` after resolution, or
- a terminal issue state if resolved in a non‑standard way (to be defined by business rules).

---

## 9. Event & Trigger Summary

To help agents design integrations, key events and triggers include:

- `order_created`
  - Triggered by Public UI / Order Module.
  - Used by:
    - Payment Module to create a payment record.
    - Shipping Module to prepare address and cost.
    - WhatsApp Module to send order confirmation + payment instructions.

- `payment_confirmed`
  - Triggered by Store Admin via Payment Module.
  - Used by:
    - Order Module to move `order_status` to `processing / awaiting_fulfillment`.
    - WhatsApp Module to send payment confirmation.

- `order_ready_to_ship`
  - Triggered by warehouse/production via Order Module.
  - Used by:
    - Shipping Module to create shipment with carrier.

- `shipment_created`
  - Triggered by Shipping Module when waybill is generated.
  - Used by:
    - Order Module to set `order_status = shipped`.
    - WhatsApp Module to send shipping notification.

- `shipping_status_updated`
  - Triggered by Shipping Module (via worker and carrier).
  - Used by:
    - Order Module to adjust major statuses (e.g., delivered).
    - WhatsApp Module to send in‑transit and delivery updates.

- `delivery_confirmed_by_customer`
  - Triggered by Customer via WhatsApp or Public UI.
  - Used by:
    - Order Module to set `order_status = completed`.
    - WhatsApp Module to send final thank‑you/feedback messages.

- `issue_reported`
  - Triggered by Customer via WhatsApp.
  - Used by:
    - Order Module to set `order_status = issue / return_in_process`.
    - Payment/Shipping Modules for return/refund flow.
    - WhatsApp Module to send complaint handling messages.

---

## 10. Agent Checklist

Before designing or implementing any workflow or automation related to orders, agents must:

- [ ] Confirm that each step (cart, order, payment, fulfillment, shipping, completion) is mapped to the **correct module** and **actor**.  
- [ ] Ensure that order creation always sets `order_status = pending_payment`, `payment_status = pending`, and `shipping_status = pending_pickup`.
- [ ] Use Payment Module to manage payment confirmation; do not directly flip order status to processing without payment.  
- [ ] Use Shipping Module and carrier integration to manage shipping status; do not manually set shipping states without logging.  
- [ ] Use WhatsApp Module to send notifications at key events (order_created, payment_confirmed, order_shipped, delivered, issues).  
- [ ] Ensure Store Admin actions (verification, status changes) go through Admin UI and domain modules, not direct database hacks.  
- [ ] Always keep the website as the **source of truth** for order, payment, and shipping states; WhatsApp is a reflection and communication channel.  
- [ ] Design issue/return flows that clearly update order, payment, and shipping states and communicate to the customer via WhatsApp.  
- [ ] Avoid creating alternative ad‑hoc flows (e.g., “orders only via WhatsApp”) that bypass this standardized lifecycle.

Any workflow or automation that contradicts this Stage 4 skill must be reconsidered and aligned with the Ragil Aluminium system design.
