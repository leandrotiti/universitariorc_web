export class AddressModel {
    constructor(id, calle, numero, departamento, localidad) {
        this.id = id;
        this.calle = calle;
        this.numero = numero;
        this.departamento = departamento;
        this.localidad = localidad;
    }

    static fromMap(map, id) {
        if (!map) return new AddressModel(id, '', '', null, '');
        return new AddressModel(
            id,
            map.calle || '',
            map.numero || '',
            map.departamento || null,
            map.localidad || ''
        );
    }

    toMap() {
        return {
            calle: this.calle,
            numero: this.numero,
            departamento: this.departamento,
            localidad: this.localidad
        };
    }
}
