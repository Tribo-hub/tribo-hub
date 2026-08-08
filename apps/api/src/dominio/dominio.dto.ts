import { IsString, Matches, MaxLength } from 'class-validator';

export class DefinirDominioDto {
  @IsString()
  @MaxLength(253)
  @Matches(/^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/, {
    message: 'Domínio inválido. Ex.: area.seudominio.com.br (sem http:// e sem barra).',
  })
  dominio!: string;
}
