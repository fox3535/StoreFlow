import { useState } from "react";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { useActionData, useNavigate, useSubmit } from "@remix-run/react";
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
  InlineGrid,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { createSupplier } from "../models/supplier.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();

  const name = (formData.get("name") as string)?.trim();
  const currency = (formData.get("currency") as string) || "USD";
  const leadTimeDays = parseInt((formData.get("leadTimeDays") as string) || "0");
  const contactInfo = ((formData.get("contactInfo") as string) || "").trim() || null;

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Supplier name is required.";
  if (isNaN(leadTimeDays) || leadTimeDays < 0)
    errors.leadTimeDays = "Enter a valid number of days.";

  if (Object.keys(errors).length > 0) return { errors };

  try {
    await createSupplier(session.shop, {
      name,
      currency,
      leadTimeDays,
      contactInfo: contactInfo ?? undefined,
    });
  } catch (e: any) {
    if (e?.code === "P2002") {
      return { errors: { name: "A supplier with this name already exists." } };
    }
    throw e;
  }

  return redirect("/app/suppliers");
};

const CURRENCY_OPTIONS = [
  { label: "USD — US Dollar", value: "USD" },
  { label: "CAD — Canadian Dollar", value: "CAD" },
  { label: "GBP — British Pound", value: "GBP" },
  { label: "EUR — Euro", value: "EUR" },
  { label: "AUD — Australian Dollar", value: "AUD" },
  { label: "JPY — Japanese Yen", value: "JPY" },
  { label: "CNY — Chinese Yuan", value: "CNY" },
];

export default function NewSupplier() {
  const actionData = useActionData<typeof action>();
  const navigate = useNavigate();
  const submit = useSubmit();

  const errors = (actionData as any)?.errors ?? {};

  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [leadTimeDays, setLeadTimeDays] = useState("0");
  const [contactInfo, setContactInfo] = useState("");

  function handleSave() {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("currency", currency);
    formData.append("leadTimeDays", leadTimeDays);
    formData.append("contactInfo", contactInfo);
    submit(formData, { method: "post" });
  }

  return (
    <Page>
      <TitleBar title="Add Supplier">
        <button onClick={() => navigate("/app/suppliers")}>Cancel</button>
        <button variant="primary" onClick={handleSave}>
          Save Supplier
        </button>
      </TitleBar>

      <Layout>
        <Layout.Section>
          <BlockStack gap="400">
            {Object.keys(errors).length > 0 && (
              <Banner tone="critical">
                <BlockStack gap="100">
                  {Object.values(errors).map((msg) => (
                    <Text key={msg as string} as="p" variant="bodyMd">
                      {msg as string}
                    </Text>
                  ))}
                </BlockStack>
              </Banner>
            )}

            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Supplier Details
                </Text>
                <Divider />
                <TextField
                  label="Supplier Name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g. Acme Wholesale"
                  autoComplete="off"
                  error={errors.name}
                />
                <InlineGrid columns={2} gap="400">
                  <Select
                    label="Default Currency"
                    options={CURRENCY_OPTIONS}
                    value={currency}
                    onChange={setCurrency}
                  />
                  <TextField
                    label="Lead Time (days)"
                    value={leadTimeDays}
                    onChange={setLeadTimeDays}
                    type="number"
                    min="0"
                    autoComplete="off"
                    error={errors.leadTimeDays}
                  />
                </InlineGrid>
                <TextField
                  label="Contact Info"
                  value={contactInfo}
                  onChange={setContactInfo}
                  placeholder="Email, phone, or website"
                  autoComplete="off"
                  multiline={2}
                />
              </BlockStack>
            </Card>

            <Box paddingBlockStart="200">
              <InlineStack gap="300">
                <Button variant="primary" onClick={handleSave}>
                  Save Supplier
                </Button>
                <Button onClick={() => navigate("/app/suppliers")}>
                  Cancel
                </Button>
              </InlineStack>
            </Box>
          </BlockStack>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                Tips
              </Text>
              <Divider />
              <Text as="p" variant="bodyMd" tone="subdued">
                Supplier name must be unique within your store.
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                SKU mappings can be added to a supplier after saving.
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                Currency is the default when creating purchase orders for this
                supplier.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
