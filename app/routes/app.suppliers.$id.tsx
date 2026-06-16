import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Divider,
  Banner,
  Badge,
  InlineGrid,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getSupplier, updateSupplier, deleteSupplier } from "../models/supplier.server";

const STATUS_META: Record<string, { tone: "info" | "warning" | "success" | "critical" | "attention" | undefined; label: string }> = {
  draft:              { tone: undefined,   label: "Draft" },
  open:               { tone: "info",      label: "Open" },
  in_transit:         { tone: "attention", label: "In Transit" },
  partially_received: { tone: "warning",   label: "Partial" },
  received:           { tone: "success",   label: "Received" },
  cancelled:          { tone: "critical",  label: "Cancelled" },
};

const CURRENCY_OPTIONS = [
  { label: "USD — US Dollar",         value: "USD" },
  { label: "CAD — Canadian Dollar",   value: "CAD" },
  { label: "EUR — Euro",              value: "EUR" },
  { label: "GBP — British Pound",     value: "GBP" },
  { label: "AUD — Australian Dollar", value: "AUD" },
  { label: "JPY — Japanese Yen",      value: "JPY" },
  { label: "CNY — Chinese Yuan",      value: "CNY" },
];

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const supplier = await getSupplier(session.shop, params.id!);
  if (!supplier) throw new Response("Not Found", { status: 404 });
  return json({ supplier });
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "delete") {
    await deleteSupplier(session.shop, params.id!);
    return redirect("/app/suppliers");
  }

  if (intent === "update") {
    const name        = (formData.get("name") as string)?.trim();
    const currency    = formData.get("currency") as string;
    const leadTimeDays = parseInt(formData.get("leadTimeDays") as string) || 0;
    const contactInfo = (formData.get("contactInfo") as string) || "";

    const errors: Record<string, string> = {};
    if (!name) errors.name = "Name is required.";
    if (leadTimeDays < 0) errors.leadTimeDays = "Must be 0 or more.";
    if (Object.keys(errors).length > 0) return json({ errors });

    await updateSupplier(session.shop, params.id!, { name, currency, leadTimeDays, contactInfo });
    return json({ success: true });
  }

  return json({ ok: true });
};

export default function SupplierDetail() {
  const { supplier } = useLoaderData<typeof loader>();
  const actionData   = useActionData<typeof action>();
  const navigate     = useNavigate();
  const submit       = useSubmit();

  const [name,         setName]        = useState(supplier.name);
  const [currency,     setCurrency]    = useState(supplier.currency);
  const [leadTimeDays, setLeadTime]    = useState(String(supplier.leadTimeDays));
  const [contactInfo,  setContact]     = useState(supplier.contactInfo ?? "");
  const [dirty,        setDirty]       = useState(false);
  const [confirmDel,   setConfirmDel]  = useState(false);

  const errors = (actionData as any)?.errors ?? {};
  const saved  = (actionData as any)?.success === true;

  function handleSave() {
    const fd = new FormData();
    fd.append("intent",       "update");
    fd.append("name",         name);
    fd.append("currency",     currency);
    fd.append("leadTimeDays", leadTimeDays);
    fd.append("contactInfo",  contactInfo);
    submit(fd, { method: "post" });
    setDirty(false);
  }

  function handleDelete() {
    if (!confirmDel) { setConfirmDel(true); return; }
    const fd = new FormData();
    fd.append("intent", "delete");
    submit(fd, { method: "post" });
  }

  const pos = supplier.purchaseOrders ?? [];
  const totalPoValue = pos.reduce((s, po) => s + po.totalLandedCost, 0);

  const th: React.CSSProperties = { padding: "8px 12px", fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6d7175", borderBottom: "1px solid #e1e3e5", background: "#fafbfb", textAlign: "left", whiteSpace: "nowrap" };
  const td: React.CSSProperties = { padding: "10px 12px", borderBottom: "1px solid #f1f2f3", verticalAlign: "middle", whiteSpace: "nowrap" };

  return (
    <Page fullWidth>
      <TitleBar title={supplier.name}>
        <button onClick={() => navigate("/app/suppliers")}>All Suppliers</button>
        <button variant="primary" onClick={handleSave} disabled={!dirty}>
          Save Changes
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {saved && (
          <Banner tone="success" onDismiss={() => {}}>
            <Text as="p" variant="bodyMd">Changes saved successfully.</Text>
          </Banner>
        )}

        {/* Summary stats row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total POs</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{pos.length}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Total PO Value</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                ${totalPoValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">SKU Mappings</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">{supplier.skuMappings.length}</Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="100">
              <Text as="p" variant="bodySm" tone="subdued">Lead Time</Text>
              <Text as="p" variant="headingXl" fontWeight="bold">
                {supplier.leadTimeDays > 0 ? `${supplier.leadTimeDays}d` : "—"}
              </Text>
            </BlockStack>
          </Card>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 280px", gap: 16, alignItems: "start" }}>
          {/* Left: details + SKU mappings + PO history */}
          <BlockStack gap="400">
            {/* Edit form */}
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Supplier Details</Text>
                <Divider />
                <TextField
                  label="Supplier Name"
                  value={name}
                  onChange={(v) => { setName(v); setDirty(true); }}
                  autoComplete="off"
                  error={errors.name}
                />
                <InlineGrid columns={2} gap="400">
                  <Select
                    label="Default Currency"
                    options={CURRENCY_OPTIONS}
                    value={currency}
                    onChange={(v) => { setCurrency(v); setDirty(true); }}
                  />
                  <TextField
                    label="Lead Time (days)"
                    type="number"
                    value={leadTimeDays}
                    onChange={(v) => { setLeadTime(v); setDirty(true); }}
                    autoComplete="off"
                    error={errors.leadTimeDays}
                  />
                </InlineGrid>
                <TextField
                  label="Contact Info"
                  value={contactInfo}
                  onChange={(v) => { setContact(v); setDirty(true); }}
                  multiline={2}
                  autoComplete="off"
                  placeholder="Email, phone, notes…"
                />
                <InlineStack align="end" gap="200">
                  <Button variant="primary" onClick={handleSave} disabled={!dirty}>
                    Save Changes
                  </Button>
                </InlineStack>
              </BlockStack>
            </Card>

            {/* SKU Mappings */}
            <Card padding="0">
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">SKU Mappings</Text>
                  <Badge>{String(supplier.skuMappings.length)}</Badge>
                </InlineStack>
              </Box>
              <Divider />
              {supplier.skuMappings.length === 0 ? (
                <Box paddingBlock="600" paddingInline="400">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    No mappings yet. These are created automatically when you match products on a PO.
                  </Text>
                </Box>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={th}>Supplier SKU</th>
                        <th style={th}>Currency</th>
                        <th style={{ ...th, textAlign: "right" }}>Unit Cost</th>
                        <th style={{ ...th, textAlign: "right" }}>Last Used Cost</th>
                        <th style={{ ...th, textAlign: "right" }}>Pack Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {supplier.skuMappings.map((m) => (
                        <tr key={m.id}>
                          <td style={td}><Text as="span" variant="bodyMd" fontWeight="semibold">{m.supplierSku}</Text></td>
                          <td style={td}>{m.currency}</td>
                          <td style={{ ...td, textAlign: "right" }}>${m.unitCost.toFixed(2)}</td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {m.lastUsedCost != null ? `$${m.lastUsedCost.toFixed(2)}` : <span style={{ color: "#8c9196" }}>—</span>}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>{m.packSize}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            {/* Purchase Order History */}
            <Card padding="0">
              <Box paddingBlock="300" paddingInline="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Purchase Order History</Text>
                  <Badge>{String(pos.length)}</Badge>
                </InlineStack>
              </Box>
              <Divider />
              {pos.length === 0 ? (
                <Box paddingBlock="600" paddingInline="400">
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    No purchase orders yet for this supplier.
                  </Text>
                </Box>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={th}>PO #</th>
                        <th style={th}>Status</th>
                        <th style={{ ...th, textAlign: "right" }}>Items</th>
                        <th style={{ ...th, textAlign: "right" }}>Landed Cost</th>
                        <th style={th}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pos.map((po) => {
                        const meta = STATUS_META[po.status] ?? { tone: undefined, label: po.status };
                        return (
                          <tr
                            key={po.id}
                            style={{ cursor: "pointer" }}
                            onClick={() => navigate(`/app/purchase-orders/${po.id}`)}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = "#f6f6f7"; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ""; }}
                          >
                            <td style={td}><Text as="span" variant="bodyMd" fontWeight="semibold">{po.poNumber}</Text></td>
                            <td style={td}><Badge tone={meta.tone}>{meta.label}</Badge></td>
                            <td style={{ ...td, textAlign: "right" }}>{po._count.lineItems}</td>
                            <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>${po.totalLandedCost.toFixed(2)}</td>
                            <td style={{ ...td, color: "#6d7175" }}>
                              {new Date(po.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </BlockStack>

          {/* Right: actions panel */}
          <div style={{ position: "sticky", top: 16 }}>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Quick Actions</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Button fullWidth onClick={() => navigate(`/app/purchase-orders/new`)}>
                      Create PO for this Supplier
                    </Button>
                    <Button fullWidth onClick={() => navigate(`/app/offers/new`)}>
                      Create Offer for this Supplier
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Info</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Currency</Text>
                    <Badge>{supplier.currency}</Badge>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Added</Text>
                    <Text as="span" variant="bodyMd">
                      {new Date(supplier.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Updated</Text>
                    <Text as="span" variant="bodyMd">
                      {new Date(supplier.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Danger Zone</Text>
                  <Divider />
                  <Text as="p" variant="bodySm" tone="subdued">
                    Deleting a supplier removes all associated SKU mappings. Linked POs are not removed.
                  </Text>
                  {confirmDel ? (
                    <BlockStack gap="200">
                      <Text as="p" variant="bodyMd" tone="critical">Are you sure? This cannot be undone.</Text>
                      <InlineStack gap="200">
                        <Button tone="critical" onClick={handleDelete}>Confirm Delete</Button>
                        <Button onClick={() => setConfirmDel(false)}>Cancel</Button>
                      </InlineStack>
                    </BlockStack>
                  ) : (
                    <Button tone="critical" onClick={() => setConfirmDel(true)}>Delete Supplier</Button>
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </div>
        </div>
      </BlockStack>
    </Page>
  );
}
