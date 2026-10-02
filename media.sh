#!/bin/bash
# Pide 10 números, los guarda en un array y calcula la media

declare -a numeros
suma=0

for (( i=0; i<10; i++ )); do
    read -p "Introduce el número $((i+1)): " num

    # Validar que sea un número entero (puede ser negativo)
    while ! [[ $num =~ ^-?[0-9]+$ ]]; do
        echo "Eso no es un número, prueba otra vez."
        read -p "Introduce el número $((i+1)): " num
    done

    numeros[$i]=$num
    suma=$(( suma + num ))
done

total=${#numeros[@]}
media=$(echo "scale=2; $suma / $total" | bc)

echo
echo "Números introducidos: ${numeros[@]}"
echo "Cantidad: $total"
echo "Suma: $suma"
echo "Media: $media"
