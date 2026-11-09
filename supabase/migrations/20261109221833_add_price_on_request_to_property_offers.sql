ALTER TABLE public.property_offers
ADD COLUMN IF NOT EXISTS price_on_request boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.property_offers.price_on_request IS
  'When true, the advertiser asks interested users to contact them for the total price.';
