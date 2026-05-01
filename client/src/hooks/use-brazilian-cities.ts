import { useQuery } from "@tanstack/react-query";

interface IBGECity {
  id: number;
  nome: string;
}

export function useBrazilianCities(state: string | undefined) {
  return useQuery<string[]>({
    queryKey: ["ibge-cities", state],
    queryFn: async () => {
      if (!state) return [];
      const response = await fetch(
        `https://servicodados.ibge.gov.br/api/v1/localidades/estados/${state}/municipios?orderBy=nome`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch cities");
      }
      const data: IBGECity[] = await response.json();
      return data.map((city) => city.nome);
    },
    enabled: !!state,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours - cities don't change often
  });
}
