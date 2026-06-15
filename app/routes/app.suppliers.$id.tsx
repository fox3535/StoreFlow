import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useActionData, useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  Select,
  Button,
  Divider,
  Banner,
  DataTable,
  Badge,
  InlineGrid,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { getSupplier, updateSupplier, deleteSupplier } from "../models/supplier.server";

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
    const name = (formData.get("name") as string)?.trim();
    const currency = formData.get("currency") as string;
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
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const [name, setName] = useState(supplier.name);
  const [currency, setCurrency] = useState(supplier.currency);
  const [leadTimeDays, setLeadTimeDays] = useState(String(supplier.leadTimeDays));
  const [contactInfo, setContactInfo] = useState(supplier.contactInfo ?? "");
  const [dirty, setDirty] = useState(false);

  const errors = (actionData as any)?.errors ?? {};
  const saved = (actionData as any)?.success === true;

  function handleSave() {
    const fd = new FormData();
    fd.append("intent", "update");
    fd.append("name", name);
    fd.append("currency", currency);
    fd.append("leadTimeDays", leadTimeDays);
    fd.append("contactInfo", contactInfo);
    submit(fd, { method: "post" });
    setDirty(false);
  }

  function handleDelete() {
    if (!confirm(`Delete supplier "${supplier.name}"? This cannot be undone.`)) return;
    const fd = new FormData();
    fd.append("intent", "delete");
    submit(fd, { method: "post" });
  }

  const poRows = (supplier as any).purchaseOrders?.map
    ? (supplier as any).purchaseOrders.map((po: any) => [
        po.poNumber,
        `$${po.totalLandedCost.toFixed(2)}`,
        po.status,
      ])
    : [];

  const skuRows = supplier.skuMappings.map((m) => [
    m.supplierSku,
    m.currency,
    `$${m.unitCost.toFixed(2)}`,
    String(m.packSize),
  ]);

  return (
    <Page>
      <TitleBar title={supplier.name}>
        <button onClick={() => navigate("/app/suppliers")}>Back</button>
        <button variant="primary" onClick={handleSave} disabled={!dirty}>
          Save Changes
        </button>
      </TitleBar>

      <BlockStack gap="500">
        {saved && (
          <Banner tone="success" onDismiss={() => {}}>
            <Text as="p" variant="bodyMd">Changes saved.</Text>
          </Banner>
        )}

        <Layout>
          <Layout.Section>
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
                      onChange={(v) => { setLeadTimeDays(v); setDirty(true); }}
                      autoComplete="off"
                      error={errors.leadTimeDays}
                    />
                  </InlineGrid>
                  <TextField
                    label="Contact Info"
                    value={contactInfo}
                    onChange={(v) => { setContactInfo(v); setDirty(true); }}
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
              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">SKU Mappings</Text>
                    <Badge>{String(supplier.skuMappings.length)}</Badge>
                  </InlineStack>
                  <Divider />
                  {supplier.skuMappings.length === 0 ? (
                    <Box paddingBlock="400">
                      <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                        No SKU mappings yet. These are created automatically when you match products on a PO.
                      </Text>
                    </Box>
                  ) : (
                    <DataTable
                      columnContentTypes={["text", "text", "numeric", "numeric"]}
                      headings={["Supplier SKU", "Currency", "Unit Cost", "Pack Size"]}
                      rows={skuRows}
                    />
                  )}
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Stats */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Summary</Text>
                  <Divider />
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">SKU Mappings</Text>
                    <Text as="span" variant="bodyMd">{supplier.skuMappings.length}</Text>
                  </InlineStack>
                  <InlineStack align="space-between">
                    <Text as="span" variant="bodyMd" tone="subdued">Added</Text>
                    <Text as="span" variant="bodyMd">
                      {new Date(supplier.createdAt).toLocaleDateString()}
                    </Text>
                  </InlineStack>
                </BlockStack>
              </Card>

              {/* Quick links */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Actions</Text>
                  <Divider />
                  <BlockStack gap="200">
                    <Button
                      fullWidth
                      onClick={() => navigate(`/app/purchase-orders/new`)}
                    >
                      Create PO for this Supplier
                    </Button>
                    <Button
                      fullWidth
                      onClick={() => navigate(`/app/offers/new`)}
                    >
                      Create Offer for this Supplier
                    </Button>
                    <Button
                      fullWidth
                      tone="critical"
                      onClick={handleDelete}
                    >
                      Delete Supplier
                    </Button>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
