interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

export interface CepData {
  address: string;
  neighborhood: string;
  city: string;
  state: string;
}

export async function fetchAddressFromCep(cep: string): Promise<CepData | null> {
  const cleanCep = cep.replace(/\D/g, "");
  
  if (cleanCep.length !== 8) {
    return null;
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
    
    if (!response.ok) {
      return null;
    }

    const data: ViaCepResponse = await response.json();

    if (data.erro) {
      return null;
    }

    return {
      address: data.logradouro || "",
      neighborhood: data.bairro || "",
      city: data.localidade || "",
      state: data.uf || "",
    };
  } catch (error) {
    console.error("Erro ao buscar CEP:", error);
    return null;
  }
}
