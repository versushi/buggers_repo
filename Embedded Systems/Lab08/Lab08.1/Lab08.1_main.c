#include <msp430.h> 
#include <stdint.h>
#define redLED BIT0 // Red LED at P1.0

#define FLAGS    UCA1IFG
#define RXFLAG   UCRXIFG
#define TXFLAG   UCTXIFG
#define RXBUFFER UCA1RXBUF
#define TXBUFFER UCA1TXBUF

void Initialize_ADC(void);

void Initialize_UART(void);
void uart_write_uint16(unsigned int n);
void uart_write_string(char *str_array);
void uart_write_char(unsigned char ch);
unsigned char uart_read_char(void);

int main(void)
{
	WDTCTL = WDTPW | WDTHOLD;	// stop watchdog timer
	PM5CTL0 &= ~LOCKLPM5;
	P1DIR |= redLED; 		// Direct pin as output
	P1OUT &= ~redLED; 		// Turn LED Off

	unsigned int x_value;
	Initialize_ADC();
    Initialize_UART();
	for(;;){
		// Start the conversion
		ADC12CTL0 |= ADC12SC;

		// Wait until the X-axis conversion finishes
		while (ADC12CTL1 & ADC12BUSY) {}

		// Read results (reading MEM clears its corresponding flag)
		x_value = ADC12MEM0;

		uart_write_string("X: ");
		uart_write_uint16(x_value);
		uart_write_string("\r\n");

		P1OUT ^= redLED;		// Toggle LED
		__delay_cycles(500000); // About 0.5 second at 1 MHz
		}
	return 0;
}

void Initialize_ADC() {
	// Configure the pins to analog functionality
	// X-axis: A10/P9.2, for A10 (P9DIR=x, P9SEL1=1, P9SEL0=1)
	P9SEL1 |= BIT2;
	P9SEL0 |= BIT2;
	// Turn on the ADC module
	ADC12CTL0 |= ADC12ON;
	// Turn off ENC (Enable Conversion) bit while modifying the configuration
	ADC12CTL0 &= ~ADC12ENC;
	//*************** ADC12CTL0 ***************
	// Set ADC12SHT0 (select the number of cycles that you computed)
	// t(sht) ≥ (4k + 10k)*(15pF+1pF)*ln(2^(12+1))
	// t(sht) ≥ 2 useconds 
	// N = t(sht)f(abc) = 2 useconds * 5.4MHz
	// N = 10.9 cycles --> round UP to 16 cycles
	// 8/5.4 MHz = 1.48 us: sampling time too short
	// 16/5.4 MHz = 2.96 us: exceeds the required 2.02 us
	// Select option 2 which is 16 cycles
	ADC12CTL0 |= ADC12SHT0_2;

	//*************** ADC12CTL1 ***************
	// Set ADC12SHS (select ADC12SC bit as the trigger)
	ADC12CTL1 |= ADC12SHS_0;
	// Set ADC12SHP bit
	ADC12CTL1 |= ADC12SHP;
	// Set ADC12DIV (select the divider you determined)
	ADC12CTL1 |= ADC12DIV_0;
	// Set ADC12SSEL (select MODOSC)
	ADC12CTL1 |= ADC12SSEL_0;

	//*************** ADC12CTL2 ***************
	// Set ADC12RES (select 12-bit resolution)
	ADC12CTL2 |= ADC12RES_2;
	// Set ADC12DF (select unsigned binary format)
	ADC12CTL2 &= ~ADC12DF;

	//*************** ADC12CTL3 ***************
	// Leave all fields at default values

	//*************** ADC12MCTL0 ***************
	// Set ADC12VRSEL (select VR+=AVCC, VR-=AVSS)
	ADC12MCTL0 |= ADC12VRSEL_0;

	// Set ADC12INCH (select channel A10)
	ADC12MCTL0 |= ADC12INCH_10;
	// Turn on ENC (Enable Conversion) bit at the end of the configuration
	ADC12CTL0 |= ADC12ENC;
	return;
}

void Initialize_UART(void){
	// Configure pins to UART functionality
	P3SEL1 &= ~(BIT4|BIT5);
	P3SEL0 |= (BIT4|BIT5);
	// Main configuration register
	UCA1CTLW0 = UCSWRST; // Engage reset; change all the fields to zero
	// Most fields in this register, when set to zero, correspond to the
	// popular configuration
	UCA1CTLW0 |= UCSSEL_2; // Set clock to SMCLK
	// Configure the clock dividers and modulators (and enable oversampling)
	UCA1BRW = 6; // divider
	// Modulators: UCBRF = 8 = 1000 --> UCBRF3 (bit #3)
	// UCBRS = 0x20 = 0010 0000 = UCBRS5 (bit #5)
	UCA1MCTLW = UCBRF3 | UCBRS5 | UCOS16;
	// Exit the reset state
	UCA1CTLW0 &= ~UCSWRST;
}

void uart_write_uint16 (unsigned int n){
	unsigned int m = 0;
	char digits[5];
	// This checks if the number is 0
	if (n == 0) {
		uart_write_char('0');
		return;
	}
	
	while (n > 0) {
		// Cuts far right digit and puts into array
        digits[m] = '0' + (n % 10);
		// Goes to the next spot in array
        m++;
		// Makes n smaller ie from 4567 --> 456
        n /= 10;
    }
	// This loop prints the array backwards since it was uploaded into the array backwards
    while (m > 0) {
        m--;
        uart_write_char(digits[m]);
    }
}

void uart_write_string (char * str_array){
	unsigned int i;
	for(i = 0;str_array[i] != '\0';i++){
		uart_write_char(str_array[i]);
	}
}

unsigned char uart_read_char(void){
	unsigned char temp;
	// Return null character (ASCII=0) if no byte was received
	if( (FLAGS & RXFLAG) == 0)
	return 0;
	// Otherwise, copy the received byte (this clears the flag) and return it
	temp = RXBUFFER;
	return temp;
}

void uart_write_char(unsigned char ch){
	// Wait for any ongoing transmission to complete
	while ( (FLAGS & TXFLAG) == 0 ) {}
	// Copy the byte to the transmit buffer
	TXBUFFER = ch; // Tx flag goes to 0 and Tx begins!
	return;
}